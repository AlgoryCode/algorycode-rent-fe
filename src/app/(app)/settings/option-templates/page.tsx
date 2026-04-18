import { redirect } from "next/navigation";

export default function LegacyOptionTemplatesRedirectPage() {
  redirect("/settings/options/vehicle");
}
