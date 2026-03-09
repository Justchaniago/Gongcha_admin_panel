/**
 * Gong Cha Admin — UI Components
 * Re-export semua komponen dari satu entry point
 *
 * CARA PAKAI:
 *   import { PageWrapper, PageHeader, TableCard, StatusBadge } from "@/components/ui";
 */

export {
  // Layout
  PageWrapper,
  PageHeader,

  // Realtime
  SyncBadge,

  // Summary
  SummaryGrid,
  SummaryCard,

  // Table
  TableCard,
  Th, Td, Tr,
  TableEmpty,

  // Form / Toolbar
  SearchInput,
  FilterSelect,
  ToolbarCount,

  // Badge & Cell
  StatusBadge,
  MonoCell,

  // Button
  ActionButton,

  // Modal
  Modal,
  DetailRow,
  ModalActions,

  // Feedback
  Toast,
} from "./ui-components";

// Types
export type { TxStatus, SyncStatus } from "@/lib/design-tokens";