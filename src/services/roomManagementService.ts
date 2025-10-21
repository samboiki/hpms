import { supabase } from '../lib/supabase';

export interface Room {
  room_number: string;
  room_type?: string;
  ward_id: string;
  ward_name?: string;
  beds: Bed[];
  total_beds: number;
  available_beds: number;
  occupied_beds: number;
  features?: string[];
  daily_rate?: number;
  description?: string;
}

export interface Bed {
  id: string;
  ward_id: string;
  bed_number: string;
  bed_code?: string;
  bed_type?: string;
  room_number?: string;
  room_type?: string;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved' | 'cleaning' | 'blocked';
  features?: string[];
  daily_rate?: number;
  last_cleaned_at?: string;
  next_maintenance_date?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  current_patient?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export interface CreateRoomData {
  room_number: string;
  room_type: string;
  ward_id: string;
  number_of_beds: number;
  bed_prefix: string;
  features?: string[];
  daily_rate?: number;
  description?: string;
}

export interface UpdateRoomData {
  room_type?: string;
  features?: string[];
  daily_rate?: number;
  description?: string;
}

class RoomManagementService {
  // ==================== ROOM OPERATIONS ====================

  async getRoomsByWard(wardId: string): Promise<{ data: Room[] | null; error: any }> {
    try {
      // Get all beds for the ward
      const { data: beds, error: bedsError } = await supabase
        .from('beds')
        .select(`
          *,
          current_patient:patients!ward_beds_current_patient_id_fkey(
            id,
            first_name,
            last_name
          )
        `)
        .eq('ward_id', wardId)
        .order('room_number', { nullsFirst: false })
        .order('bed_number');

      if (bedsError) throw bedsError;

      // Get ward information
      const { data: ward, error: wardError } = await supabase
        .from('wards')
        .select('ward_name')
        .eq('id', wardId)
        .single();

      if (wardError) throw wardError;

      // Group beds by room number
      const roomMap = new Map<string, Room>();

      beds?.forEach(bed => {
        const roomNumber = bed.room_number || 'Unassigned';

        if (!roomMap.has(roomNumber)) {
          roomMap.set(roomNumber, {
            room_number: roomNumber,
            room_type: bed.room_type,
            ward_id: wardId,
            ward_name: ward?.ward_name,
            beds: [],
            total_beds: 0,
            available_beds: 0,
            occupied_beds: 0,
            features: bed.features,
            daily_rate: bed.daily_rate,
          });
        }

        const room = roomMap.get(roomNumber)!;
        room.beds.push(bed);
        room.total_beds++;

        if (bed.status === 'available') {
          room.available_beds++;
        } else if (bed.status === 'occupied') {
          room.occupied_beds++;
        }
      });

      const rooms = Array.from(roomMap.values()).sort((a, b) => {
        // Sort unassigned to the end
        if (a.room_number === 'Unassigned') return 1;
        if (b.room_number === 'Unassigned') return -1;
        // Natural sort for room numbers
        return a.room_number.localeCompare(b.room_number, undefined, { numeric: true });
      });

      return { data: rooms, error: null };
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return { data: null, error };
    }
  }

  async getRoomDetails(wardId: string, roomNumber: string): Promise<{ data: Room | null; error: any }> {
    try {
      const { data: rooms, error } = await this.getRoomsByWard(wardId);
      if (error) throw error;

      const room = rooms?.find(r => r.room_number === roomNumber);
      return { data: room || null, error: null };
    } catch (error) {
      console.error('Error fetching room details:', error);
      return { data: null, error };
    }
  }

  async createRoom(roomData: CreateRoomData): Promise<{ data: any; error: any }> {
    try {
      const { ward_id, room_number, room_type, number_of_beds, bed_prefix, features, daily_rate } = roomData;

      // Check if room number already exists in ward
      const { data: existingBeds, error: checkError } = await supabase
        .from('beds')
        .select('id')
        .eq('ward_id', ward_id)
        .eq('room_number', room_number)
        .limit(1);

      if (checkError) throw checkError;

      if (existingBeds && existingBeds.length > 0) {
        throw new Error(`Room ${room_number} already exists in this ward`);
      }

      // Get ward code for bed codes
      const { data: ward, error: wardError } = await supabase
        .from('wards')
        .select('ward_code')
        .eq('id', ward_id)
        .single();

      if (wardError) throw wardError;

      // Create beds for the room
      const beds = [];
      for (let i = 1; i <= number_of_beds; i++) {
        const bed_number = `${bed_prefix}${i}`;
        const bed_code = ward?.ward_code
          ? `${ward.ward_code}-${room_number}-${bed_number}`
          : `${room_number}-${bed_number}`;

        beds.push({
          ward_id,
          bed_number,
          bed_code,
          bed_type: 'standard',
          room_number,
          room_type,
          status: 'available',
          features,
          daily_rate,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Insert all beds
      const { data: insertedBeds, error: insertError } = await supabase
        .from('beds')
        .insert(beds)
        .select();

      if (insertError) throw insertError;

      // Update ward bed count
      await this.updateWardBedCount(ward_id);

      return { data: { room_number, beds: insertedBeds }, error: null };
    } catch (error) {
      console.error('Error creating room:', error);
      return { data: null, error };
    }
  }

  async updateRoom(wardId: string, roomNumber: string, updates: UpdateRoomData): Promise<{ data: any; error: any }> {
    try {
      // Update all beds in the room
      const { data, error } = await supabase
        .from('beds')
        .update({
          room_type: updates.room_type,
          features: updates.features,
          daily_rate: updates.daily_rate,
          updated_at: new Date().toISOString()
        })
        .eq('ward_id', wardId)
        .eq('room_number', roomNumber)
        .select();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error updating room:', error);
      return { data: null, error };
    }
  }

  async deleteRoom(wardId: string, roomNumber: string): Promise<{ error: any }> {
    try {
      // Check if any beds in the room are occupied
      const { data: beds, error: checkError } = await supabase
        .from('beds')
        .select('id, status, bed_number')
        .eq('ward_id', wardId)
        .eq('room_number', roomNumber);

      if (checkError) throw checkError;

      const occupiedBeds = beds?.filter(bed => bed.status === 'occupied');
      if (occupiedBeds && occupiedBeds.length > 0) {
        throw new Error(`Cannot delete room ${roomNumber}: ${occupiedBeds.length} bed(s) are occupied`);
      }

      // Delete all beds in the room
      const { error: deleteError } = await supabase
        .from('beds')
        .delete()
        .eq('ward_id', wardId)
        .eq('room_number', roomNumber);

      if (deleteError) throw deleteError;

      // Update ward bed count
      await this.updateWardBedCount(wardId);

      return { error: null };
    } catch (error) {
      console.error('Error deleting room:', error);
      return { error };
    }
  }

  async createMultipleRooms(wardId: string, roomsData: CreateRoomData[]): Promise<{ data: any; error: any }> {
    try {
      const results = [];

      for (const roomData of roomsData) {
        const { data, error } = await this.createRoom({ ...roomData, ward_id: wardId });
        if (error) {
          console.error(`Error creating room ${roomData.room_number}:`, error);
          continue;
        }
        results.push(data);
      }

      return { data: results, error: null };
    } catch (error) {
      console.error('Error creating multiple rooms:', error);
      return { data: null, error };
    }
  }

  async addBedsToRoom(wardId: string, roomNumber: string, numberOfBeds: number, bedPrefix: string): Promise<{ data: any; error: any }> {
    try {
      // Get room details
      const { data: existingBeds, error: fetchError } = await supabase
        .from('beds')
        .select('*')
        .eq('ward_id', wardId)
        .eq('room_number', roomNumber)
        .order('bed_number', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      if (!existingBeds || existingBeds.length === 0) {
        throw new Error(`Room ${roomNumber} not found`);
      }

      const roomInfo = existingBeds[0];

      // Get the highest bed number to continue from
      const { data: allRoomBeds, error: allBedsError } = await supabase
        .from('beds')
        .select('bed_number')
        .eq('ward_id', wardId)
        .eq('room_number', roomNumber);

      if (allBedsError) throw allBedsError;

      const maxNumber = allRoomBeds?.reduce((max, bed) => {
        const match = bed.bed_number.match(/\d+$/);
        const num = match ? parseInt(match[0]) : 0;
        return Math.max(max, num);
      }, 0) || 0;

      // Get ward code
      const { data: ward, error: wardError } = await supabase
        .from('wards')
        .select('ward_code')
        .eq('id', wardId)
        .single();

      if (wardError) throw wardError;

      // Create new beds
      const newBeds = [];
      for (let i = 1; i <= numberOfBeds; i++) {
        const bed_number = `${bedPrefix}${maxNumber + i}`;
        const bed_code = ward?.ward_code
          ? `${ward.ward_code}-${roomNumber}-${bed_number}`
          : `${roomNumber}-${bed_number}`;

        newBeds.push({
          ward_id: wardId,
          bed_number,
          bed_code,
          bed_type: roomInfo.bed_type || 'standard',
          room_number: roomNumber,
          room_type: roomInfo.room_type,
          status: 'available',
          features: roomInfo.features,
          daily_rate: roomInfo.daily_rate,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Insert new beds
      const { data: insertedBeds, error: insertError } = await supabase
        .from('beds')
        .insert(newBeds)
        .select();

      if (insertError) throw insertError;

      // Update ward bed count
      await this.updateWardBedCount(wardId);

      return { data: insertedBeds, error: null };
    } catch (error) {
      console.error('Error adding beds to room:', error);
      return { data: null, error };
    }
  }

  async removeBedsFromRoom(wardId: string, roomNumber: string, bedIds: string[]): Promise<{ error: any }> {
    try {
      // Check if any of the beds are occupied
      const { data: beds, error: checkError } = await supabase
        .from('beds')
        .select('id, status, bed_number')
        .in('id', bedIds);

      if (checkError) throw checkError;

      const occupiedBeds = beds?.filter(bed => bed.status === 'occupied');
      if (occupiedBeds && occupiedBeds.length > 0) {
        const bedNumbers = occupiedBeds.map(b => b.bed_number).join(', ');
        throw new Error(`Cannot remove occupied beds: ${bedNumbers}`);
      }

      // Delete the beds
      const { error: deleteError } = await supabase
        .from('beds')
        .delete()
        .in('id', bedIds);

      if (deleteError) throw deleteError;

      // Update ward bed count
      await this.updateWardBedCount(wardId);

      return { error: null };
    } catch (error) {
      console.error('Error removing beds from room:', error);
      return { error };
    }
  }

  // ==================== HELPER FUNCTIONS ====================

  private async updateWardBedCount(wardId: string) {
    try {
      const { data: beds } = await supabase
        .from('beds')
        .select('status')
        .eq('ward_id', wardId);

      const total_beds = beds?.length || 0;
      const occupied_beds = beds?.filter(b => b.status === 'occupied').length || 0;

      await supabase
        .from('wards')
        .update({
          total_beds,
          occupied_beds,
          updated_at: new Date().toISOString()
        })
        .eq('id', wardId);

    } catch (error) {
      console.error('Error updating ward bed count:', error);
    }
  }

  // ==================== VALIDATION ====================

  async validateRoomNumber(wardId: string, roomNumber: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('beds')
        .select('id')
        .eq('ward_id', wardId)
        .eq('room_number', roomNumber)
        .limit(1);

      if (error) throw error;
      return !data || data.length === 0;
    } catch (error) {
      console.error('Error validating room number:', error);
      return false;
    }
  }

  async checkRoomOccupancy(wardId: string, roomNumber: string): Promise<{ occupied: boolean; occupiedCount: number }> {
    try {
      const { data, error } = await supabase
        .from('beds')
        .select('status')
        .eq('ward_id', wardId)
        .eq('room_number', roomNumber)
        .eq('status', 'occupied');

      if (error) throw error;

      return {
        occupied: data && data.length > 0,
        occupiedCount: data?.length || 0
      };
    } catch (error) {
      console.error('Error checking room occupancy:', error);
      return { occupied: false, occupiedCount: 0 };
    }
  }
}

export const roomManagementService = new RoomManagementService();