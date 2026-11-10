import type { FC } from "react";
import { Card } from "@/components/ui/card";
import { SignInForm } from "./components/sign-in-form";
import { Link } from "react-router-dom";

const Login: FC = () => {
  return (
    <Card className="p-6 max-w-md mx-auto">
      <div className="flex flex-col space-y-2 text-left">
        <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
        <p className="text-sm text-muted-foreground">
          Enter your username and password below <br />
          to log into your account
        </p>
      </div>
      <SignInForm />

      {/* <div className="text-center text-sm mt-3">
        <Link to="/auth/forgot-password" className="text-muted-foreground hover:text-primary">
          Forgot password?
        </Link>
      </div> */}

      <div className="text-center text-sm mt-3">
        Don&apos;t have an account?{" "}
        <Link to="/auth/sign-up" className="underline underline-offset-4">
          Sign up
        </Link>
      </div>

      {/* <p className="mt-4 px-8 text-center text-sm text-muted-foreground">
        By clicking login, you agree to our{" "}
        <a href="/terms" className="underline underline-offset-4 hover:text-primary">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline underline-offset-4 hover:text-primary">
          Privacy Policy
        </a>
        .
      </p> */}
    </Card>
  );
};

export default Login;
