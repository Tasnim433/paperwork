import { PlaceholderPage, placeholderMetadata } from "@/components/placeholder-page";

export const generateMetadata = () => placeholderMetadata("overview");

export default function Page() {
  return <PlaceholderPage page="overview" />;
}
