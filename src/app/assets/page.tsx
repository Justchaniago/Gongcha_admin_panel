import AssetsClient from "./AssetsClient";

export const metadata = {
  title: "Asset Library | Gongcha App Admin",
  description:
    "Manage image assets for the 'products' and 'rewards' storage roots. The asset grid now supports lazy loading, and bulk move/delete operations are enabled.",
};

export default function AssetsPage() {
  return <AssetsClient />;
}
