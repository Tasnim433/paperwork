import { PlaceholderPage, placeholderMetadata } from "@/components/placeholder-page";

export const generateMetadata = () => placeholderMetadata("settings");

export default function Page() {
  return <PlaceholderPage page="settings" />;
}
