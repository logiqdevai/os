import { Switch } from "./switch";
import { LoaderCircle } from "lucide-react";

interface ToggleProps {
  enabled: boolean;
  isLoading: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export default function Toggle({ isLoading, enabled, onCheckedChange }: ToggleProps) {
  return isLoading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Switch checked={enabled} onCheckedChange={onCheckedChange} />;
}
