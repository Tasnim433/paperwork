import { PlaceholderPage, placeholderMetadata } from "@/components/placeholder-page";

export const generateMetadata = () => placeholderMetadata("workDays");

export default function Page() {
  return <PlaceholderPage page="workDays" />;
}
