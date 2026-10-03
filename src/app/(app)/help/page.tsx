import { PlaceholderPage, pageMetadata } from "@/components/placeholder-page";

export const generateMetadata = () => pageMetadata("help");

export default function Page() {
  return <PlaceholderPage page="help" />;
}
