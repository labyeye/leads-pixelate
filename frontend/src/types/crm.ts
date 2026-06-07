export type UserRole =
  | "super_admin"
  | "admin"
  | "sales_executive"
  | "service_manager"
  | "accountant";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  department?: string;
  employeeId?: string;
  status: "active" | "inactive";
  lastLogin?: string;
}

export interface Lead {
  _id?: string;
  id?: string;
  name: string;
  company: string;
  source: "IndiaMART" | "TradeIndia" | "Justdial" | "Website" | "Manual";
  phone: string;
  email: string;
  requirement: string;
  status:
    | "PENDING CONTACT"
    | "1"
    | "2"
    | "3"
    | "COMPLETED"
    | "DISCUSSION"
    | "QUOTATION"
    | "VISIT SCHEDULED"
    | "VISITED"
    | "WON"
    | "DROP";
  contactTag?: "HOT" | "WARM" | "COLD";
  budget?: string;
  remarks?: string;
  interestedProducts?: string[];
  followUpDate?: string;
  visitScheduledDate?: string;
  visitActualDate?: string;
  stagePath?: string[];
  statusHistory?: Array<{
    status: string;
    timestamp: string;
    changedBy?: any;
    remarks?: string;
  }>;
  assignedTo?: string;
  indiamartQueryTime?: string;
  createdAt?: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  businessType: string;
  gst?: string;
  services: string[];
  projectStatus: "Active" | "Completed" | "On Hold";
  paymentStatus: "Paid" | "Pending" | "Overdue";
  notes?: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  assignedTo: string;
  status: "Active" | "Inactive";
  linkedClients: number;
  progress: number;
  timeline: string;
}

export interface Quotation {
  id: string;
  number: string;
  date: string;
  clientName: string;
  projectTitle: string;
  services: { name: string; price: number; quantity: number }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: "Draft" | "Sent" | "Approved" | "Rejected";
  notes?: string;
}

export const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  sales_executive: "Sales Executive",
  service_manager: "Service Manager",
  accountant: "Accountant",
};

export const roleColors: Record<UserRole, string> = {
  super_admin: "bg-primary/10 text-primary",
  admin: "bg-secondary/10 text-secondary",
  sales_executive: "bg-success/10 text-success",
  service_manager: "bg-warning/10 text-warning",
  accountant: "bg-muted text-muted-foreground",
};
