// Guest identity for leaderboards: a random id (so a guest keeps one row per
// activity even if they change nickname) plus the last nickname used.
const ID_KEY = "pb-guest-id";
const NAME_KEY = "pb-nickname";

export function getGuestId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export const getSavedNickname = () => localStorage.getItem(NAME_KEY) ?? "";
export const saveNickname = (name: string) => localStorage.setItem(NAME_KEY, name);
