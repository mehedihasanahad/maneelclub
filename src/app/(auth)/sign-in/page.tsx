import { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Maneel Club account",
  // Utility page with no search value.
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return <SignInForm />;
}
