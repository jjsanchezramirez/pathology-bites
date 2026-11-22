# Admin UI standard

Every admin page is built from the same few pieces so spacing, type and
breakpoints line up. Primitives live in `src/shared/components/ui/page-layout.tsx`
and `page-header.tsx`; the shared `Table` primitives carry the table defaults.

## Page skeleton

```tsx
<PageContainer>                      // space-y-6 between sections
  <PageHeader title="Images" description="…" actions={<Button>Upload</Button>} />
  <StatGrid>                         // 1 → 2 → 4 columns
    <StatCard label="Total" value={42} icon={ImageIcon} hint="+3 this week" />
  </StatGrid>
  <SectionCard title="Library" description="…" actions={…}>
    …                                // body is p-4 sm:p-6, space-y-4
  </SectionCard>
  <ContentGrid columns={2}>          // 1 → 2 columns at lg
    <SectionCard title="A">…</SectionCard>
    <SectionCard title="B">…</SectionCard>
  </ContentGrid>
</PageContainer>
```

Do not wrap pages in `container`, `mx-auto p-6`, or `max-w-*`: the layout
shell already provides padding and the max width. Use
`<PageContainer width="narrow">` for form or settings pages.

## Scale

| Thing                                        | Class                                                              |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Gap between page sections                    | `space-y-6` (PageContainer)                                        |
| Gap inside a card                            | `space-y-4`                                                        |
| Grid gap                                     | `gap-4`                                                            |
| Inline group (buttons, badges, icon + label) | `gap-2`                                                            |
| Card padding                                 | `p-4 sm:p-6`                                                       |
| Table cells                                  | `px-4 py-3` (default `TableCell`)                                  |
| Page title                                   | `text-2xl sm:text-3xl font-bold tracking-tight` (PageHeader)       |
| Section / card title                         | `text-lg font-semibold` (SectionCard, PageSection)                 |
| Stat label / value                           | `text-sm font-medium text-muted-foreground` / `text-2xl font-bold` |
| Body                                         | `text-sm`                                                          |
| Meta / captions                              | `text-xs text-muted-foreground`                                    |
| Section icon                                 | `h-5 w-5`; inline icon `h-4 w-4`                                   |

Anything outside these sizes needs a reason.

## Tables

```tsx
<Toolbar>…search, filters, actions…</Toolbar>
<TableShell footer={<Pagination />}>
  <Table>
    <TableHeader>…</TableHeader>   // muted background, xs uppercase labels by default
    <TableBody>…</TableBody>
  </Table>
</TableShell>
```

`Table` scrolls horizontally on small screens. Put `hidden md:table-cell` on
low-priority columns (dates, IDs, secondary metadata) so phones show the
essentials. Don't restyle `TableHeader` / `TableHead` per table.

Inside a card, use `<SectionCard flush title="…">` and put the table directly in
it: the body loses its padding so rows run edge to edge.

## Responsive rules

- Header actions, toolbars and card actions wrap (`flex-wrap`) instead of overflowing.
- Content grids start at one column and widen at `md` / `lg`; stat grids start at two. Never fixed columns.
- Give flex children that hold text `min-w-0` so `truncate` works.
- Dialogs: `max-w-[calc(100vw-2rem)]` is the floor; scroll the body, not the page.

## Exceptions

Lesson Studio (`/admin/lesson-studio`) is a full-bleed editor with its own dense
tool chrome and is intentionally outside this standard.
