/**
 * UsersTable — characterization tests.
 *
 * Written BEFORE decomposing the 823-line monolith (extract UserRow, the four
 * dialogs, pagination, and the pure helpers). useSWR + the auth hooks are mocked so
 * the table renders deterministically; assertions are against the DOM and pin:
 *   - row content: display-name (first+last vs email fallback), type-label mapping, joined date
 *   - the Actions column is gated on isAdmin
 *   - pagination "Showing X to Y of Z" + page-chip navigation (page state)
 *
 * Radix dropdown/dialog interactions aren't driveable in happy-dom, so the dialog
 * bodies (verbatim moves) are left to build/tsc + batch QA.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ isAdmin: true }));

vi.mock("swr", () => ({ default: vi.fn() }));
vi.mock("@/shared/hooks/use-user-role", () => ({
  useUserRole: () => ({ isAdmin: h.isAdmin }),
}));
vi.mock("@/features/auth/components/auth-provider", () => ({
  useAuthContext: () => ({ user: { id: "me" } }),
}));
vi.mock("@/shared/utils/ui/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/shared/utils/logging", () => ({
  log: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/shared/utils/api/api-client", () => ({ apiClient: { delete: vi.fn() } }));

import useSWR from "swr";
import { UsersTable } from "@/features/admin/users/components/users-table";

const mockedUseSWR = useSWR as unknown as Mock;

type MockUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  user_type: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function user(p: Partial<MockUser> & { id: string }): MockUser {
  return {
    email: `${p.id}@example.com`,
    first_name: null,
    last_name: null,
    role: "user",
    user_type: "student",
    status: "active",
    created_at: "2024-03-15T12:00:00", // local (no Z) → tz-independent format
    updated_at: "2024-03-15T12:00:00",
    ...p,
  };
}

function mockSWR(users: MockUser[], extra: { totalUsers?: number; totalPages?: number } = {}) {
  mockedUseSWR.mockReturnValue({
    data: {
      users,
      totalUsers: extra.totalUsers ?? users.length,
      totalPages: extra.totalPages ?? 1,
    },
    isLoading: false,
    mutate: vi.fn(),
  });
}

beforeEach(() => {
  h.isAdmin = true;
  vi.clearAllMocks();
});

describe("UsersTable — characterization", () => {
  it("renders display name (first+last), email, mapped type label, and joined date", () => {
    mockSWR([user({ id: "u1", first_name: "Ada", last_name: "Lovelace", user_type: "resident" })]);
    render(<UsersTable />);

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("u1@example.com")).toBeTruthy();
    expect(screen.getByText("Resident")).toBeTruthy(); // userTypeConfig mapping
    expect(screen.getByText("Mar 15, 2024")).toBeTruthy(); // date-fns format
  });

  it("falls back to email as the display name when no first/last name", () => {
    mockSWR([user({ id: "u2", first_name: null, last_name: null, email: "solo@x.io" })]);
    render(<UsersTable />);
    // email shows twice (as the display name AND the sub-line); the name cell is .font-medium
    const nameCell = screen
      .getAllByText("solo@x.io")
      .find((el) => el.classList.contains("font-medium"));
    expect(nameCell).toBeTruthy();
  });

  it("shows the raw user_type when it has no config mapping", () => {
    mockSWR([user({ id: "u3", user_type: "weird_type" })]);
    render(<UsersTable />);
    expect(screen.getByText("weird_type")).toBeTruthy();
  });

  it("renders the Actions column only for admins", () => {
    mockSWR([user({ id: "u1" })]);
    const { rerender } = render(<UsersTable />);
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeTruthy();

    h.isAdmin = false;
    rerender(<UsersTable />);
    expect(screen.queryByRole("columnheader", { name: "Actions" })).toBeNull();
  });

  it("shows the empty state when there are no users", () => {
    mockSWR([], { totalUsers: 0, totalPages: 0 });
    render(<UsersTable />);
    expect(screen.getByText("No users found")).toBeTruthy();
  });

  it("paginates: 'Showing X to Y of Z' tracks the active page chip", () => {
    const many = Array.from({ length: 10 }, (_, i) => user({ id: `u${i}` }));
    mockSWR(many, { totalUsers: 25, totalPages: 3 });
    render(<UsersTable />);

    expect(screen.getByText("Showing 1 to 10 of 25 users")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Showing 11 to 20 of 25 users")).toBeTruthy();
  });

  it("renders a row per user", () => {
    mockSWR([
      user({ id: "a", first_name: "Aaa", last_name: "One" }),
      user({ id: "b", first_name: "Bbb", last_name: "Two" }),
    ]);
    render(<UsersTable />);
    const body = screen.getAllByRole("rowgroup")[1]; // [0]=thead, [1]=tbody
    expect(within(body).getAllByRole("row")).toHaveLength(2);
  });
});
