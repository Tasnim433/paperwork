import { PlaceholderPage, placeholderMetadata } from "@/components/placeholder-page";

export const generateMetadata = () => placeholderMetadata("inbox");

export default function Page() {
  return <PlaceholderPage page="inbox" />;
}
