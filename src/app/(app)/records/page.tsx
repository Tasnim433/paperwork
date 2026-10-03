import { PlaceholderPage, placeholderMetadata } from "@/components/placeholder-page";

export const generateMetadata = () => placeholderMetadata("records");

export default function Page() {
  return <PlaceholderPage page="records" />;
}
