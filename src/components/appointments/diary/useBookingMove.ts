import { useState } from 'react';
import type React from 'react';
import { toast } from 'react-hot-toast';
import { isSameSlot, moveConfirmQuestion, moveProblem, type MovableBooking } from '../../../utils/diary/bookingMove';

/** A booking the grids draw: what the move rules read, and what the drag picture shows */
export interface DraggableBooking extends MovableBooking {
  type: string;
  patient?: { first_name?: string | null; last_name?: string | null } | null;
}

export interface BookingMoveOptions<T extends DraggableBooking> {
  /** Saves the move; true when it was saved */
  onDrop?: (bookingId: string, time: Date, practitionerId: string) => Promise<boolean>;
  /** Everything reception must confirm at the new time (the booking form's checks) */
  onCheckMove?: (bookingId: string, time: Date, practitionerId: string) => Promise<string[]>;
  /** What to confirm when the diary passes no full check (blocked time, public holidays) */
  localReasons: (booking: T, time: Date, practitionerId: string) => string[];
}

/**
 * Dragging a booking to another time, and in the day grid to another practitioner. The day and the week grid share
 * this, so a move asks the same questions in both: nothing happens on its own slot, a visit that started stays, and
 * whatever the checks find is confirmed before the booking moves.
 */
export function useBookingMove<T extends DraggableBooking>({ onDrop, onCheckMove, localReasons }: BookingMoveOptions<T>) {
  const [dragged, setDragged] = useState<T | null>(null);
  const [dropTarget, setDropTarget] = useState<{ time: Date; practitionerId: string } | null>(null);

  const reset = () => {
    setDragged(null);
    setDropTarget(null);
  };

  const dragStart = (event: React.DragEvent, booking: T) => {
    setDragged(booking);
    event.dataTransfer.effectAllowed = 'move';
    // The picture under the pointer: the patient and the visit type, set as text (a name is never read as HTML)
    const picture = document.createElement('div');
    picture.className = 'bg-white shadow-lg rounded-lg p-3 border-2 border-[#01b9d5]';
    const name = document.createElement('div');
    name.className = 'font-medium text-sm';
    name.textContent = `${booking.patient?.first_name ?? ''} ${booking.patient?.last_name ?? ''}`.trim();
    const type = document.createElement('div');
    type.className = 'text-xs text-gray-500';
    type.textContent = booking.type;
    picture.append(name, type);
    picture.style.position = 'absolute';
    picture.style.top = '-1000px';
    document.body.appendChild(picture);
    event.dataTransfer.setDragImage(picture, 0, 0);
    setTimeout(() => picture.remove(), 0);
  };

  const dragOver = (event: React.DragEvent, time: Date, practitionerId: string) => {
    // Only a booking from this grid can be dropped (not a file dragged in from elsewhere)
    if (!dragged) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget((current) =>
      current && current.practitionerId === practitionerId && current.time.getTime() === time.getTime() ? current : { time, practitionerId }
    );
  };

  const drop = async (event: React.DragEvent, time: Date, practitionerId: string) => {
    event.preventDefault();
    // The drag ends (and resets) while the checks below are still running
    const booking = dragged;
    if (!booking || !onDrop) return;
    if (isSameSlot(booking, time, practitionerId)) {
      reset();
      return;
    }
    const problem = moveProblem(booking, practitionerId);
    if (problem) {
      toast.error(problem);
      reset();
      return;
    }

    let reasons: string[];
    try {
      reasons = onCheckMove ? await onCheckMove(booking.id, time, practitionerId) : localReasons(booking, time, practitionerId);
    } catch (error) {
      console.error('Could not check the new time:', error);
      reasons = ['The diary could not be checked for clashes at the new time.'];
    }
    if (reasons.length > 0 && !window.confirm(moveConfirmQuestion(reasons))) {
      reset();
      return;
    }

    const toastId = toast.loading('Moving appointment...');
    try {
      const saved = await onDrop(booking.id, time, practitionerId);
      if (saved) toast.success('Appointment rescheduled successfully', { id: toastId });
      else toast.error('Failed to move appointment', { id: toastId });
    } catch (error) {
      toast.error('Error moving appointment', { id: toastId });
      console.error('Error dropping appointment:', error);
    }
    reset();
  };

  return { dragged, dropTarget, isDragging: dragged !== null, dragStart, dragOver, drop, dragEnd: reset };
}
