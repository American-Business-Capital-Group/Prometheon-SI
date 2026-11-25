import PlatformPage from "@/components/PlatformPage";
import { platformById } from "@/lib/platforms";

export default function Page() {
  return <PlatformPage platform={platformById("ignis")} />;
}
