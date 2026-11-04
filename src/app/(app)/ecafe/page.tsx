import { CafeOrderFlow } from "@/components/modules/ecafe/order-flow";
import { ECAFE_MENU } from "@/lib/data/ecafe";

export const metadata = { title: "e-cafe" };

export default function ECafePage() {
  return (
    <CafeOrderFlow
      menu={ECAFE_MENU}
      upiId={process.env.NEXT_PUBLIC_ECAFE_UPI_ID?.trim() ?? ""}
    />
  );
}
