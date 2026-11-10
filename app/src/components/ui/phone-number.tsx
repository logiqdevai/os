import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CountryOptions } from "@/config/constants/dropdowns/country.options";

interface PhoneNumberProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value?: string;
  countryCode?: string;
  onValueChange?: (phone: string) => void;
  onCountryCodeChange?: (code: string) => void;
  defaultCountryCode?: string;
}

const PhoneNumber = React.forwardRef<HTMLInputElement, PhoneNumberProps>(({ className, value = "", countryCode, onValueChange, onCountryCodeChange, defaultCountryCode = "+30", disabled, ...props }, ref) => {
  const [selectedCountryCode, setSelectedCountryCode] = React.useState<string>(countryCode || defaultCountryCode);

  React.useEffect(() => {
    if (countryCode !== undefined || defaultCountryCode !== undefined) {
      setSelectedCountryCode(countryCode || defaultCountryCode);
    }
  }, [countryCode, defaultCountryCode]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange?.(e.target.value);
  };

  const handleCountryCodeChange = (code: string) => {
    setSelectedCountryCode(code);
    onCountryCodeChange?.(code);
  };

  return (
    <div className={cn("flex w-full items-center rounded-md border border-input bg-transparent overflow-hidden", disabled && "opacity-50 cursor-not-allowed", className)}>
      <Select value={selectedCountryCode} onValueChange={handleCountryCodeChange} disabled={disabled}>
        <SelectTrigger
          className="
              h-11 
              w-[110px]
              border-r border-input
              rounded-none
              bg-transparent
              focus:ring-0 
              focus:ring-offset-0
            "
        >
          <SelectValue placeholder={selectedCountryCode} />
        </SelectTrigger>
        <SelectContent className="max-h-[220px] overflow-y-auto">
          {CountryOptions.map((option) => (
            <SelectItem key={option.value} value={option.phone_code}>
              <div className="flex items-center gap-2">
                <span>{option.icon}</span>
                <span>{option.phone_code}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input ref={ref} type="tel" value={value} onChange={handlePhoneChange} disabled={disabled} {...props} className={cn("h-11 flex-1 rounded-none bg-transparent px-3", "border-none !border-0 !outline-none !shadow-none", "focus-visible:!ring-0 focus-visible:!ring-offset-0", "focus:!ring-0 focus:!ring-offset-0", "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")} />
    </div>
  );
});

PhoneNumber.displayName = "PhoneNumber";

export { PhoneNumber };
