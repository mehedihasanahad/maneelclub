/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSettings, updateSettings } from "@/actions/admin/settings";
import {
  DEFAULT_SETTINGS,
  DEFAULT_HEADER_MENU,
  DEFAULT_FOOTER_COLUMNS,
  DEFAULT_FOOTER_BOTTOM_LINKS,
  parseLinkList,
  parseFooterColumns,
  type LinkItem,
  type FooterColumn,
} from "@/lib/settings-defaults";
import { LinkListEditor } from "@/components/admin/link-list-editor";
import { FooterColumnsEditor } from "@/components/admin/footer-columns-editor";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

/** Header menu editor state: an empty list is never shown, it falls back to the default menu. */
function parseHeaderMenu(raw: string | undefined): LinkItem[] {
  const items = parseLinkList(raw, DEFAULT_HEADER_MENU);
  return items.length > 0 ? items : DEFAULT_HEADER_MENU;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS as unknown as Record<string, string>);
  const [menuItems, setMenuItems] = useState<LinkItem[]>(DEFAULT_HEADER_MENU);
  const [footerColumns, setFooterColumns] = useState<FooterColumn[]>(DEFAULT_FOOTER_COLUMNS);
  const [footerBottomLinks, setFooterBottomLinks] = useState<LinkItem[]>(DEFAULT_FOOTER_BOTTOM_LINKS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setIsLoading(true);
    try {
      const result = await getSettings();
      if (result.success && result.data) {
        setSettings(result.data);
        setMenuItems(parseHeaderMenu(result.data.headerMenu));
        setFooterColumns(parseFooterColumns(result.data.footerColumns, DEFAULT_FOOTER_COLUMNS));
        setFooterBottomLinks(parseLinkList(result.data.footerBottomLinks, DEFAULT_FOOTER_BOTTOM_LINKS));
      } else {
        toast.error(result.error || "Failed to load settings");
      }
    } catch (error) {
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }

  function handleChange(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }

  function handleSwitchChange(key: string, checked: boolean) {
    setSettings((prev) => ({ ...prev, [key]: checked ? "true" : "false" }));
    setHasChanges(true);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const result = await updateSettings(settings);
      if (result.success) {
        toast.success("Settings saved successfully");
        setHasChanges(false);
      } else {
        toast.error(result.error || "Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      setSettings(DEFAULT_SETTINGS as unknown as Record<string, string>);
      setMenuItems(DEFAULT_HEADER_MENU);
      setFooterColumns(DEFAULT_FOOTER_COLUMNS);
      setFooterBottomLinks(DEFAULT_FOOTER_BOTTOM_LINKS);
      setHasChanges(true);
    }
  }

  function updateMenuItems(next: LinkItem[]) {
    setMenuItems(next);
    setSettings((prev) => ({ ...prev, headerMenu: JSON.stringify(next) }));
    setHasChanges(true);
  }

  function updateFooterColumns(next: FooterColumn[]) {
    setFooterColumns(next);
    setSettings((prev) => ({ ...prev, footerColumns: JSON.stringify(next) }));
    setHasChanges(true);
  }

  function updateFooterBottomLinks(next: LinkItem[]) {
    setFooterBottomLinks(next);
    setSettings((prev) => ({ ...prev, footerBottomLinks: JSON.stringify(next) }));
    setHasChanges(true);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Card>
          <CardHeader><Skeleton className="h-6 w-20" /></CardHeader>
          <CardContent className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your store settings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} disabled={isSaving}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
          You have unsaved changes. Click &quot;Save Changes&quot; to apply them.
        </div>
      )}

      <Tabs defaultValue="general" className="space-y-0">
        {/* Tab list: horizontal scroll on mobile; clear separation so Store Information never overlaps */}
        <div className="relative z-0 mb-4 border-b border-border bg-background pb-3 pt-1 md:mb-0 md:border-0 md:pb-0 md:pt-0">
          <div className="-mx-1 overflow-x-auto px-1 md:mx-0 md:overflow-visible md:px-0 [scrollbar-width:thin]">
            <TabsList className="inline-flex h-10 w-max min-w-full flex-none flex-nowrap gap-0 rounded-lg border bg-muted/80 p-1 md:grid md:w-full md:grid-cols-8 md:flex-initial">
              <TabsTrigger value="general" className="max-md:flex-none max-md:flex-shrink-0 md:flex-1">General</TabsTrigger>
              <TabsTrigger value="navigation" className="max-md:flex-none max-md:flex-shrink-0 md:flex-1">Navigation</TabsTrigger>
              <TabsTrigger value="footer" className="max-md:flex-none max-md:flex-shrink-0 md:flex-1">Footer</TabsTrigger>
              <TabsTrigger value="shipping" className="max-md:flex-none max-md:flex-shrink-0 md:flex-1">Shipping</TabsTrigger>
              <TabsTrigger value="payment" className="max-md:flex-none max-md:flex-shrink-0 md:flex-1">Payment</TabsTrigger>
              <TabsTrigger value="announcement" className="max-md:flex-none max-md:flex-shrink-0 md:flex-1">Announcement</TabsTrigger>
              <TabsTrigger value="security" className="max-md:flex-none max-md:flex-shrink-0 md:flex-1">Security</TabsTrigger>
              <TabsTrigger value="seo" className="max-md:flex-none max-md:flex-shrink-0 md:flex-1">SEO</TabsTrigger>
              <TabsTrigger value="tracking" className="max-md:flex-none max-md:flex-shrink-0 md:flex-1">Tracking</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* General Settings */}
        <TabsContent value="general" className="mt-0 space-y-6 pt-4 md:pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Store Information</CardTitle>
              <CardDescription>Basic information about your store</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Store Name</Label>
                  <Input
                    id="storeName"
                    value={settings.storeName || ""}
                    onChange={(e) => handleChange("storeName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeEmail">Store Email</Label>
                  <Input
                    id="storeEmail"
                    type="email"
                    value={settings.storeEmail || ""}
                    onChange={(e) => handleChange("storeEmail", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="storePhone">Phone Number</Label>
                  <Input
                    id="storePhone"
                    value={settings.storePhone || ""}
                    onChange={(e) => handleChange("storePhone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
                  <Input
                    id="whatsappNumber"
                    value={settings.whatsappNumber || ""}
                    onChange={(e) => handleChange("whatsappNumber", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="storeDescription">Store Description</Label>
                <Textarea
                  id="storeDescription"
                  value={settings.storeDescription || ""}
                  onChange={(e) => handleChange("storeDescription", e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Social Links</CardTitle>
              <CardDescription>Your store&apos;s social media presence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="facebookUrl">Facebook URL</Label>
                  <Input
                    id="facebookUrl"
                    value={settings.facebookUrl || ""}
                    onChange={(e) => handleChange("facebookUrl", e.target.value)}
                    placeholder="https://facebook.com/yourpage"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagramUrl">Instagram URL</Label>
                  <Input
                    id="instagramUrl"
                    value={settings.instagramUrl || ""}
                    onChange={(e) => handleChange("instagramUrl", e.target.value)}
                    placeholder="https://instagram.com/yourpage"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory Settings</CardTitle>
              <CardDescription>Configure inventory management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                <Input
                  id="lowStockThreshold"
                  type="number"
                  value={settings.lowStockThreshold || "5"}
                  onChange={(e) => handleChange("lowStockThreshold", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Products with stock at or below this number will show a low stock warning
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security / Order limits */}
        <TabsContent value="security" className="mt-0 space-y-6 pt-4 md:pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Order cooldown</CardTitle>
              <CardDescription>
                Limit how often the same phone number can place an order (helps reduce spam). When enabled, a customer must wait before placing another order.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="orderCooldownEnabled">Enable order cooldown</Label>
                  <p className="text-sm text-muted-foreground">
                    Same phone number cannot place another order within the cooldown window
                  </p>
                </div>
                <Switch
                  id="orderCooldownEnabled"
                  checked={settings.orderCooldownEnabled === "true"}
                  onCheckedChange={(checked) => handleSwitchChange("orderCooldownEnabled", checked)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderCooldownMinutes">Cooldown (minutes)</Label>
                <Input
                  id="orderCooldownMinutes"
                  type="number"
                  min={1}
                  max={1440}
                  value={settings.orderCooldownMinutes || "10"}
                  onChange={(e) => handleChange("orderCooldownMinutes", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Minimum minutes between orders from the same phone number (1–1440)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Navigation / Header Menu */}
        <TabsContent value="navigation" className="mt-0 space-y-6 pt-4 md:pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Header Menu</CardTitle>
              <CardDescription>
                Manage the main navigation links in the storefront header. Order is top to bottom (first item appears left).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LinkListEditor
                items={menuItems}
                onChange={updateMenuItems}
                minItems={1}
                addLabel="Add menu item"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Footer */}
        <TabsContent value="footer" className="mt-0 space-y-6 pt-4 md:pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Brand</CardTitle>
              <CardDescription>
                Short text shown under the logo in the footer. Store name, phone, email, Facebook and Instagram come from the General tab.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="footerTagline">Tagline</Label>
                <Textarea
                  id="footerTagline"
                  value={settings.footerTagline || ""}
                  onChange={(e) => handleChange("footerTagline", e.target.value)}
                  rows={2}
                  placeholder="Premium clothing brand in Bangladesh."
                />
                <p className="text-sm text-muted-foreground">Leave empty to hide the tagline.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Link Columns</CardTitle>
              <CardDescription>
                Link columns shown between the brand block and the Contact column. The current design uses two: Shop and Support.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FooterColumnsEditor columns={footerColumns} onChange={updateFooterColumns} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
              <CardDescription>
                Address shown in the footer Contact column. Phone and email come from the General tab.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="footerAddress">Address</Label>
                <Textarea
                  id="footerAddress"
                  value={settings.footerAddress || ""}
                  onChange={(e) => handleChange("footerAddress", e.target.value)}
                  rows={3}
                  placeholder={"Block #A, Muntaha Tower\nKeraniganj, Dhaka"}
                />
                <p className="text-sm text-muted-foreground">One line per row. Leave empty to hide the address.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="footerMapUrl">Map link</Label>
                <Input
                  id="footerMapUrl"
                  value={settings.footerMapUrl || ""}
                  onChange={(e) => handleChange("footerMapUrl", e.target.value)}
                  placeholder="https://maps.app.goo.gl/..."
                />
                <p className="text-sm text-muted-foreground">The address links to this URL when set.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bottom Links</CardTitle>
              <CardDescription>Links next to the copyright line, e.g. Privacy Policy and Terms of Service.</CardDescription>
            </CardHeader>
            <CardContent>
              <LinkListEditor
                items={footerBottomLinks}
                onChange={updateFooterBottomLinks}
                labelPlaceholder="e.g. Privacy Policy"
                hrefPlaceholder="e.g. /privacy"
                addLabel="Add link"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shipping Settings */}
        <TabsContent value="shipping" className="mt-0 space-y-6 pt-4 md:pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Shipping Rates</CardTitle>
              <CardDescription>Configure shipping costs for different areas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shippingDhaka">Dhaka City Rate (BDT)</Label>
                  <Input
                    id="shippingDhaka"
                    type="number"
                    value={settings.shippingDhaka || "80"}
                    onChange={(e) => handleChange("shippingDhaka", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shippingOutside">Outside Dhaka Rate (BDT)</Label>
                  <Input
                    id="shippingOutside"
                    type="number"
                    value={settings.shippingOutside || "130"}
                    onChange={(e) => handleChange("shippingOutside", e.target.value)}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="freeShippingMinimum">Free Shipping Minimum (BDT)</Label>
                <Input
                  id="freeShippingMinimum"
                  type="number"
                  value={settings.freeShippingMinimum || "2000"}
                  onChange={(e) => handleChange("freeShippingMinimum", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Orders above this amount get free shipping (set to 0 to disable)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payment" className="mt-0 space-y-6 pt-4 md:pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Mobile Payment Numbers</CardTitle>
              <CardDescription>
                Configure merchant numbers for mobile payment methods.
                These numbers will be shown to customers during checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bkashNumber">bKash Number</Label>
                <Input
                  id="bkashNumber"
                  value={settings.bkashNumber || ""}
                  onChange={(e) => handleChange("bkashNumber", e.target.value)}
                  placeholder="01XXXXXXXXX"
                />
                <p className="text-sm text-muted-foreground">
                  Your bKash personal/merchant number
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="nagadNumber">Nagad Number</Label>
                <Input
                  id="nagadNumber"
                  value={settings.nagadNumber || ""}
                  onChange={(e) => handleChange("nagadNumber", e.target.value)}
                  placeholder="01XXXXXXXXX"
                />
                <p className="text-sm text-muted-foreground">
                  Your Nagad personal/merchant number
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="rocketNumber">Rocket Number</Label>
                <Input
                  id="rocketNumber"
                  value={settings.rocketNumber || ""}
                  onChange={(e) => handleChange("rocketNumber", e.target.value)}
                  placeholder="01XXXXXXXXX"
                />
                <p className="text-sm text-muted-foreground">
                  Your Rocket personal/merchant number
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Announcement Settings */}
        <TabsContent value="announcement" className="mt-0 space-y-6 pt-4 md:pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Announcement Bar</CardTitle>
              <CardDescription>
                Configure the announcement bar that appears at the top of your store
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Announcement</Label>
                  <p className="text-sm text-muted-foreground">
                    Show announcement bar on all pages
                  </p>
                </div>
                <Switch
                  checked={settings.announcementEnabled === "true"}
                  onCheckedChange={(checked) => handleSwitchChange("announcementEnabled", checked)}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="announcementMessage">Announcement Message</Label>
                <Input
                  id="announcementMessage"
                  value={settings.announcementMessage || ""}
                  onChange={(e) => handleChange("announcementMessage", e.target.value)}
                  placeholder="Free shipping on orders over BDT 2000!"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="announcementLink">Link URL</Label>
                  <Input
                    id="announcementLink"
                    value={settings.announcementLink || ""}
                    onChange={(e) => handleChange("announcementLink", e.target.value)}
                    placeholder="/shop"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcementLinkText">Link Text</Label>
                  <Input
                    id="announcementLinkText"
                    value={settings.announcementLinkText || ""}
                    onChange={(e) => handleChange("announcementLinkText", e.target.value)}
                    placeholder="Shop Now"
                  />
                </div>
              </div>

              <Separator className="my-6" />
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">Countdown timer</h4>
                  <p className="text-sm text-muted-foreground">
                    Show a countdown (e.g. &quot;Offer ends in 2d 5h 30m&quot;) to create urgency. When the end time is reached, the bar hides.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Show countdown</Label>
                  <Switch
                    checked={settings.announcementCountdownEnabled === "true"}
                    onCheckedChange={(checked) => handleSwitchChange("announcementCountdownEnabled", checked)}
                  />
                </div>
                {settings.announcementCountdownEnabled === "true" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="announcementCountdownEnd">Offer ends at (date & time)</Label>
                      <Input
                        id="announcementCountdownEnd"
                        type="datetime-local"
                        value={
                          settings.announcementCountdownEnd
                            ? new Date(settings.announcementCountdownEnd).toISOString().slice(0, 16)
                            : ""
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          handleChange("announcementCountdownEnd", v ? new Date(v).toISOString() : "");
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use your local time; stored in UTC. Leave empty to hide countdown.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="announcementCountdownLabel">Countdown label</Label>
                      <Input
                        id="announcementCountdownLabel"
                        value={settings.announcementCountdownLabel || ""}
                        onChange={(e) => handleChange("announcementCountdownLabel", e.target.value)}
                        placeholder="Offer ends in"
                      />
                      <p className="text-xs text-muted-foreground">
                        Text before the timer, e.g. &quot;Offer ends in&quot; → &quot;Offer ends in 2d 5h 30m&quot;
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tracking Settings */}
        <TabsContent value="seo" className="mt-0 space-y-6 pt-4 md:pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Homepage</CardTitle>
              <CardDescription>
                How the homepage appears on Google and in AI answers. Leave a
                field empty to build it from Store Name and Store Description on
                the General tab.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seoHomeTitle">Meta Title</Label>
                <Input
                  id="seoHomeTitle"
                  placeholder={`${settings.storeName || "Maneel Club"} | ${settings.storeDescription || "Premium clothing brand in Bangladesh"}`}
                  value={settings.seoHomeTitle || ""}
                  onChange={(e) => handleChange("seoHomeTitle", e.target.value)}
                  maxLength={70}
                />
                <p className="text-sm text-muted-foreground">
                  {(settings.seoHomeTitle || "").length === 0
                    ? "Automatic: store name + description."
                    : `${(settings.seoHomeTitle || "").length} / 60 characters`}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoHomeDescription">Meta Description</Label>
                <Textarea
                  id="seoHomeDescription"
                  placeholder={settings.storeDescription || "Premium clothing brand in Bangladesh"}
                  value={settings.seoHomeDescription || ""}
                  onChange={(e) => handleChange("seoHomeDescription", e.target.value)}
                  rows={3}
                  maxLength={200}
                />
                <p className="text-sm text-muted-foreground">
                  {(settings.seoHomeDescription || "").length === 0
                    ? "Automatic: the store description."
                    : `${(settings.seoHomeDescription || "").length} / 160 characters`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shop Page</CardTitle>
              <CardDescription>
                Metadata for the /shop listing page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seoShopTitle">Meta Title</Label>
                <Input
                  id="seoShopTitle"
                  placeholder="Shop"
                  value={settings.seoShopTitle || ""}
                  onChange={(e) => handleChange("seoShopTitle", e.target.value)}
                  maxLength={70}
                />
                <p className="text-sm text-muted-foreground">
                  The store name is appended automatically.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoShopDescription">Meta Description</Label>
                <Textarea
                  id="seoShopDescription"
                  placeholder={`Browse all products at ${settings.storeName || "Maneel Club"}. Premium clothing at affordable prices.`}
                  value={settings.seoShopDescription || ""}
                  onChange={(e) => handleChange("seoShopDescription", e.target.value)}
                  rows={3}
                  maxLength={200}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Keywords</CardTitle>
              <CardDescription>
                Comma separated. Google ignores the keywords meta tag, so this
                has little effect on ranking - it is kept for other crawlers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="seoKeywords">Meta Keywords</Label>
                <Input
                  id="seoKeywords"
                  placeholder="clothing, fashion, bangladesh, t-shirts, hoodies"
                  value={settings.seoKeywords || ""}
                  onChange={(e) => handleChange("seoKeywords", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Per-page SEO</CardTitle>
              <CardDescription>
                Individual products and categories have their own SEO fields.
                Edit a product or category to set its meta title, description
                and canonical URL.
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="tracking" className="mt-0 space-y-6 pt-4 md:pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Google Tag Manager</CardTitle>
              <CardDescription>
                Enter your GTM container ID to load the Google Tag Manager script site-wide. The site uses a <code className="text-xs bg-muted px-1 rounded">dataLayer</code> so you can configure tags (e.g. Meta Pixel, GA4) inside GTM.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gtmContainerId">GTM Container ID</Label>
                <Input
                  id="gtmContainerId"
                  value={settings.gtmContainerId || ""}
                  onChange={(e) => handleChange("gtmContainerId", e.target.value)}
                  placeholder="GTM-52G5CZNB"
                />
                <p className="text-sm text-muted-foreground">
                  Found in Google Tag Manager → Admin → Container ID. Example: GTM-52G5CZNB
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meta Pixel / Facebook Tracking</CardTitle>
              <CardDescription>
                Enable Meta Pixel to load the base script (init + PageView). Events (ViewContent, AddToCart, InitiateCheckout, Purchase) are pushed to <code className="text-xs bg-muted px-1 rounded">dataLayer</code>—use GTM to forward them to Meta, or they can be used by your own Pixel config. Set these after deployment; tracking does not work reliably on localhost.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Meta Pixel</Label>
                  <p className="text-sm text-muted-foreground">
                    Load the Pixel script (fbq init + PageView) on every page
                  </p>
                </div>
                <Switch
                  checked={settings.metaPixelEnabled === "true"}
                  onCheckedChange={(checked) => handleSwitchChange("metaPixelEnabled", checked)}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="metaPixelId">Pixel ID</Label>
                <Input
                  id="metaPixelId"
                  value={settings.metaPixelId || ""}
                  onChange={(e) => handleChange("metaPixelId", e.target.value)}
                  placeholder="4205919286299642"
                />
                <p className="text-sm text-muted-foreground">
                  Found in Meta Events Manager → Data Sources → Your Pixel → Settings
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="metaCapiAccessToken">Conversions API Access Token (optional)</Label>
                <Input
                  id="metaCapiAccessToken"
                  type="password"
                  value={settings.metaCapiAccessToken || ""}
                  onChange={(e) => handleChange("metaCapiAccessToken", e.target.value)}
                  placeholder="••••••••••••••••"
                  autoComplete="off"
                />
                <p className="text-sm text-muted-foreground">
                  For server-side Purchase events. Generate in Events Manager → Settings → Conversions API. Stored securely—never sent to the browser.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Floating Save Button for Mobile */}
      {hasChanges && (
        <div className="fixed bottom-20 right-4 md:hidden">
          <Button onClick={handleSave} disabled={isSaving} size="lg" className="shadow-lg">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
