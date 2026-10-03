import { PlaceholderPage, placeholderMetadata } from "@/components/placeholder-page";

export const generateMetadata = () => placeholderMetadata("review");

export default function Page() {
  return <PlaceholderPage page="review" />;
}
