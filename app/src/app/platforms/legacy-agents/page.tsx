import PlatformPage from "@/components/PlatformPage";
import CreateAgentForm from "@/components/CreateAgentForm";
import { platformById } from "@/lib/platforms";

export default function Page() {
  return (
    <>
      <PlatformPage platform={platformById("legacy")} />
      <CreateAgentForm />
    </>
  );
}
