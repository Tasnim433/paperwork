import { PlaceholderPage, placeholderMetadata } from "@/components/placeholder-page";

export const generateMetadata = () => placeholderMetadata("tasks");

export default function Page() {
  return <PlaceholderPage page="tasks" />;
}
