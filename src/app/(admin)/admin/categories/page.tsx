"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/actions/admin/products";
import { slugify } from "@/lib/format";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { ImageUploader } from "@/components/admin";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  parent?: { id: string; name: string; slug: string } | null;
  children?: Category[];
  _count?: { products: number };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string>("");
  const [parentId, setParentId] = useState<string | null>(null);
  // SEO overrides - blank means the storefront uses name/description.
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const result = await getAdminCategories();
      if (result.success) {
        setCategories(result.data as Category[]);
      } else {
        toast.error(result.error || "Failed to load categories");
      }
    } catch (error) {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }

  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parentId),
    [categories]
  );

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setActionLoading(true);
    try {
      const categorySlug = slugify(slug) || slugify(name);
      const result = await createCategory(
        name.trim(),
        categorySlug,
        description.trim() || undefined,
        parentId || undefined,
        image.trim() || undefined,
        {
          metaTitle: metaTitle.trim() || null,
          metaDescription: metaDescription.trim() || null,
          canonicalUrl: canonicalUrl.trim() || null,
        }
      );

      if (result.success) {
        toast.success("Category created successfully");
        setDialogOpen(false);
        resetForm();
        loadCategories();
      } else {
        toast.error(result.error || "Failed to create category");
      }
    } catch (error) {
      toast.error("Failed to create category");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editCategoryId || !name.trim()) return;

    setActionLoading(true);
    try {
      const categorySlug = slugify(slug) || slugify(name);
      const result = await updateCategory(editCategoryId, {
        name: name.trim(),
        slug: categorySlug,
        description: description.trim() || undefined,
        parentId: parentId || null,
        image: image.trim() || null,
        metaTitle: metaTitle.trim() || null,
        metaDescription: metaDescription.trim() || null,
        canonicalUrl: canonicalUrl.trim() || null,
      });

      if (result.success) {
        toast.success("Category updated successfully");
        setDialogOpen(false);
        setEditCategoryId(null);
        resetForm();
        loadCategories();
      } else {
        toast.error(result.error || "Failed to update category");
      }
    } catch (error) {
      toast.error("Failed to update category");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setActionLoading(true);
    try {
      const result = await deleteCategory(id);
      if (result.success) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        toast.success("Category deleted successfully");
        loadCategories();
      } else {
        toast.error(result.error || "Failed to delete category");
      }
    } catch (error) {
      toast.error("Failed to delete category");
    } finally {
      setActionLoading(false);
      setDeleteCategoryId(null);
    }
  }

  function resetForm() {
    setName("");
    setSlug("");
    setDescription("");
    setImage("");
    setParentId(null);
    setMetaTitle("");
    setMetaDescription("");
    setCanonicalUrl("");
  }

  function openNewDialog() {
    resetForm();
    setEditCategoryId(null);
    setDialogOpen(true);
  }

  function openEditDialog(category: Category) {
    setName(category.name);
    setSlug(category.slug);
    setDescription(category.description || "");
    setImage(category.image || "");
    setParentId(category.parentId || null);
    setMetaTitle(category.metaTitle || "");
    setMetaDescription(category.metaDescription || "");
    setCanonicalUrl(category.canonicalUrl || "");
    setEditCategoryId(category.id);
    setDialogOpen(true);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value));
    }
  }

  // Flatten categories for table: parents first, then children
  const flattenedCategories = useMemo(() => {
    const result: Category[] = [];
    for (const parent of parentCategories) {
      result.push(parent);
      const children = categories.filter((c) => c.parentId === parent.id);
      for (const child of children) {
        result.push(child);
      }
    }
    const orphans = categories.filter((c) => c.parentId && !parentCategories.some((p) => p.id === c.parentId));
    result.push(...orphans);
    return result;
  }, [categories, parentCategories]);

  const filteredCategories = flattenedCategories.filter(
    (category) =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (category.parent?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isEdit = !!editCategoryId;
  const parentOptionsForForm = parentCategories.filter(
    (p) => p.id !== editCategoryId
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-28 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <Card>
          <CardContent className="p-0">
            <TableSkeleton columns={4} rows={8} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground">
            Manage product categories and subcategories
          </p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Products</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <p className="text-muted-foreground">No categories found</p>
                    <Button variant="link" onClick={openNewDialog}>
                      Add your first category
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      {category.parentId ? (
                        <span className="text-muted-foreground pl-4">
                          └ {category.name}
                        </span>
                      ) : (
                        category.name
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                        {category.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      {category.parent ? (
                        <Badge variant="outline">{category.parent.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {category.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {category._count?.products || 0} products
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(category)}
                          title="Edit category"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteCategoryId(category.id)}
                          disabled={(category._count?.products || 0) > 0}
                          title={
                            (category._count?.products || 0) > 0
                              ? "Cannot delete category with products"
                              : "Delete category"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Category" : "Add New Category"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update category details."
                : "Create a parent category or subcategory."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="parent">Parent Category</Label>
              <Select
                value={parentId || "none"}
                onValueChange={(v) => setParentId(v === "none" ? null : v)}
              >
                <SelectTrigger id="parent" className="w-full">
                  <SelectValue placeholder="None (top-level category)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level category)</SelectItem>
                  {parentOptionsForForm.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Leave empty for a parent category. Products go in subcategories.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Category name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                placeholder="category-slug"
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]+/g, "-")
                      .replace(/-{2,}/g, "-")
                      .replace(/^-/, "")
                  )
                }
              />
              <p className="text-sm text-muted-foreground">
                URL-friendly name. Auto-generated from name if left empty.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Category description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Category image</Label>
              <p className="text-sm text-muted-foreground">
                Shown on the homepage &quot;Shop by Category&quot; section. Leave empty to use default.
              </p>
              <ImageUploader
                images={image ? [image] : []}
                onChange={(urls) => setImage(urls[0] ?? "")}
                maxImages={1}
              />
            </div>

            {/* SEO - every field optional; blank falls back to name/description. */}
            <div className="space-y-4 border-t pt-4">
              <div>
                <h4 className="font-medium">SEO</h4>
                <p className="text-sm text-muted-foreground">
                  How this category appears on Google and in AI answers. Leave
                  empty to use the automatic value.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaTitle">Meta Title</Label>
                <Input
                  id="metaTitle"
                  placeholder={name || "Category name"}
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  maxLength={70}
                />
                <p className="text-sm text-muted-foreground">
                  {metaTitle.length === 0
                    ? "Automatic: the category name."
                    : `${metaTitle.length} / 60 characters`}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaDescription">Meta Description</Label>
                <Textarea
                  id="metaDescription"
                  placeholder={description || `Shop ${name || "this category"} at Maneel Club`}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  rows={3}
                  maxLength={200}
                />
                <p className="text-sm text-muted-foreground">
                  {metaDescription.length === 0
                    ? "Automatic: the description above."
                    : `${metaDescription.length} / 160 characters`}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="canonicalUrl">Canonical URL</Label>
                <Input
                  id="canonicalUrl"
                  placeholder={`https://maneelclub.com/product-category/${slug || "category-slug"}`}
                  value={canonicalUrl}
                  onChange={(e) => setCanonicalUrl(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Leave empty unless this category duplicates another one.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={isEdit ? handleUpdate : handleCreate}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEdit ? "Updating..." : "Creating..."}
                </>
              ) : isEdit ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteCategoryId}
        onOpenChange={() => setDeleteCategoryId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? This action cannot
              be undone. Subcategories will also be deleted if this is a parent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteCategoryId && handleDelete(deleteCategoryId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
