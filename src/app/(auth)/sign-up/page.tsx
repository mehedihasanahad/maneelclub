import { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a new Maneel Club account",
  // Utility page with no search value.
  robots: { index: false, follow: true },
};

export default function SignUpPage() {
  return <SignUpForm />;
}
