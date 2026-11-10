import { Card } from "@/components/ui/card";
import { SignUpForm } from "./components/sign-up-form";
import { Suspense } from "react";
import { Link } from "react-router-dom";

export default function SignUp() {
  return (
    <Card className="p-6 max-w-md mx-auto">
      <div className="mb-2 flex flex-col space-y-2 text-left">
        <h1 className="text-lg font-semibold tracking-tight">Create an account</h1>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <SignUpForm />
      </Suspense>

      <div className="text-center text-sm mt-3">
        Already have an account?{" "}
        <Link to="/auth/sign-in" className="underline underline-offset-4">
          Sign In
        </Link>
      </div>
    </Card>
  );
}
