import { PlaceholderPage, placeholderMetadata } from "@/components/placeholder-page";

export const generateMetadata = () => placeholderMetadata("help");

export default function Page() {
  return <PlaceholderPage page="help" />;
}
