

## Problem

In `InspectionPhotoUploadGrid.tsx`, the `Card` wrapper (line 133) and the hidden file `input` (line 207) share the **exact same `id`**: `photo-slot-${slot.id}`. 

When a `<label htmlFor="photo-slot-front_view">` is clicked, the browser finds the **first element** with that ID — the `Card` div — not the `input`. So the file picker never opens.

## Fix

Rename the input's `id` to use a different prefix, e.g. `photo-input-${slot.id}`, and update the `htmlFor` references on both labels (empty state label on line 184, and the "Trocar/Reenviar" label on line 174) to match.

**File**: `src/components/inspection/InspectionPhotoUploadGrid.tsx`

1. Line 127: Change `inputId` from `photo-slot-${slot.id}` to `photo-input-${slot.id}`

That single change fixes everything since `inputId` is already used consistently in both `htmlFor` attributes and the `input`'s `id`. The Card keeps its `photo-slot-${slot.id}` id (used for scroll-to-element in re-upload flow).

