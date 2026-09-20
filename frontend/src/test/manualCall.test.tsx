import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManualCallDialog } from "@/components/leads/ManualCallDialog";

const manual = vi.fn();
vi.mock("@/services/api", () => ({ callsAPI: { manual: (...a: any[]) => manual(...a), status: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { phone: "+919999900000" } }) }));

const lead = { _id: "a".repeat(24), name: "Riya", phone: "9876543210" };

describe("ManualCallDialog", () => {
  it("prefills the agent's number and places the call", async () => {
    manual.mockResolvedValue({ data: { callLogId: "c1", callSid: "CA1" } });
    render(<ManualCallDialog open onClose={() => {}} lead={lead} toast={vi.fn()} />);
    expect((screen.getByLabelText("Your phone number") as HTMLInputElement).value).toBe("+919999900000");
    fireEvent.click(screen.getByRole("button", { name: /call me now/i }));
    await waitFor(() => expect(screen.getByText(/Starting the call/)).toBeTruthy());
    expect(manual).toHaveBeenCalledWith({ leadId: lead._id, agentPhone: "+919999900000", remember: false });
  });

  it("shows Twilio's refusal and stays on the form", async () => {
    manual.mockRejectedValue(new Error("not verified"));
    const toast = vi.fn();
    render(<ManualCallDialog open onClose={() => {}} lead={lead} toast={toast} />);
    fireEvent.click(screen.getByRole("button", { name: /call me now/i }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: "not verified" })));
    expect(screen.getByLabelText("Your phone number")).toBeTruthy();
  });
});
