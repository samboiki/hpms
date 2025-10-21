import { supabase } from '../lib/supabase';

export interface Ward {
  id: string;
  practice_id: string;
  branch_id?: string;
  department_id?: string;
  ward_name: string;
  ward_code?: string;
  ward_type?: string;
  floor_number?: number;
  total_beds: number;
  occupied_beds: number;
  nurse_station_ext?: string;
  head_nurse_id?: string;
  description?: string;
  features?: string[];
  visiting_hours_start?: string;
  visiting_hours_end?: string;
  max_visitors_per_patient?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  department?: {
    id: string;
    name: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  head_nurse?: {
    id: string;
    name: string;
  };
}

export interface WardFormData {
  ward_name: string;
  ward_code?: string;
  ward_type?: string;
  floor_number?: number;
  branch_id?: string;
  department_id?: string;
  nurse_station_ext?: string;
  head_nurse_id?: string;
  description?: string;
  features?: string[];
  visiting_hours_start?: string;
  visiting_hours_end?: string;
  max_visitors_per_patient?: number;
  is_active: boolean;
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
}

export interface Room {
  room_number: string;
  room_type?: string;
  beds: Bed[];
  total_beds: number;
  available_beds: number;
}

class WardManagementService {
  // ==================== WARD OPERATIONS ====================

  async getWardsByDepartment(departmentId: string) {
    try {
      const { data, error } = await supabase
        .from('wards')
        .select('*')
        .eq('department_id', departmentId)
        .order('ward_name');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching wards:', error);
      return { data: null, error };
    }
  }

  async getWardsByPractice(practiceId: string) {
    try {
      const { data, error } = await supabase
        .from('wards')
        .select('*')
        .eq('practice_id', practiceId)
        .order('department_id', { nullsFirst: false })
        .order('ward_name');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching practice wards:', error);
      return { data: null, error };
    }
  }

  async createWard(practiceId: string, wardData: WardFormData) {
    try {
      const { data, error } = await supabase
        .from('wards')
        .insert({
          ...wardData,
          practice_id: practiceId,
          total_beds: 0,
          occupied_beds: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating ward:', error);
      return { data: null, error };
    }
  }

  async updateWard(wardId: string, updates: Partial<WardFormData>) {
    try {
      const { data, error } = await supabase
        .from('wards')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', wardId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating ward:', error);
      return { data: null, error };
    }
  }

  async deleteWard(wardId: string) {
    try {
      // Check if ward has beds
      const { data: beds, error: bedsError } = await supabase
        .from('beds')
        .select('id')
        .eq('ward_id', wardId)
        .limit(1);

      if (bedsError) throw bedsError;

      if (beds && beds.length > 0) {
        throw new Error('Cannot delete ward with existing beds. Please remove all beds first.');
      }

      const { error } = await supabase
        .from('wards')
        .delete()
        .eq('id', wardId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting ward:', error);
      return { error };
    }
  }

  // ==================== BED OPERATIONS ====================

  async getBedsByWard(wardId: string) {
    try {
      const { data, error } = await supabase
        .from('beds')
        .select('*')
        .eq('ward_id', wardId)
        .order('room_number', { nullsFirst: false })
        .order('bed_number');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching beds:', error);
      return { data: null, error };
    }
  }

  async getRoomsByWard(wardId: string): Promise<{ data: Room[] | null, error: any }> {
    try {
      const { data: beds, error } = await this.getBedsByWard(wardId);
      if (error) throw error;

      // Group beds by room number
      const roomMap = new Map<string, Room>();

      beds?.forEach(bed => {
        const roomNumber = bed.room_number || 'Unassigned';

        if (!roomMap.has(roomNumber)) {
          roomMap.set(roomNumber, {
            room_number: roomNumber,
            room_type: bed.room_type,
            beds: [],
            total_beds: 0,
            available_beds: 0
          });
        }

        const room = roomMap.get(roomNumber)!;
        room.beds.push(bed);
        room.total_beds++;
        if (bed.status === 'available') {
          room.available_beds++;
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

  async createBed(wardId: string, bedData: {
    bed_number: string;
    bed_type?: string;
    room_number?: string;
    room_type?: string;
    features?: string[];
    daily_rate?: number;
  }) {
    try {
      // Generate bed code
      const wardResponse = await supabase
        .from('wards')
        .select('ward_code')
        .eq('id', wardId)
        .single();

      const bed_code = wardResponse.data?.ward_code
        ? `${wardResponse.data.ward_code}-${bedData.room_number || 'XX'}-${bedData.bed_number}`
        : null;

      const { data, error } = await supabase
        .from('beds')
        .insert({
          ...bedData,
          ward_id: wardId,
          bed_code,
          status: 'available',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Update ward bed count
      await this.updateWardBedCount(wardId);

      return { data, error: null };
    } catch (error) {
      console.error('Error creating bed:', error);
      return { data: null, error };
    }
  }

  async createMultipleBeds(wardId: string, bedsData: Array<{
    bed_number: string;
    bed_type?: string;
    room_number?: string;
    room_type?: string;
    features?: string[];
    daily_rate?: number;
  }>) {
    try {
      // Get ward code for bed codes
      const wardResponse = await supabase
        .from('wards')
        .select('ward_code')
        .eq('id', wardId)
        .single();

      const bedsToInsert = bedsData.map(bed => ({
        ...bed,
        ward_id: wardId,
        bed_code: wardResponse.data?.ward_code
          ? `${wardResponse.data.ward_code}-${bed.room_number || 'XX'}-${bed.bed_number}`
          : null,
        status: 'available',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('beds')
        .insert(bedsToInsert)
        .select();

      if (error) throw error;

      // Update ward bed count
      await this.updateWardBedCount(wardId);

      return { data, error: null };
    } catch (error) {
      console.error('Error creating multiple beds:', error);
      return { data: null, error };
    }
  }

  async updateBed(bedId: string, updates: Partial<Bed>) {
    try {
      const { data, error } = await supabase
        .from('beds')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', bedId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating bed:', error);
      return { data: null, error };
    }
  }

  async deleteBed(bedId: string) {
    try {
      // Get ward_id before deletion
      const { data: bed } = await supabase
        .from('beds')
        .select('ward_id, status')
        .eq('id', bedId)
        .single();

      if (bed?.status === 'occupied') {
        throw new Error('Cannot delete an occupied bed');
      }

      const { error } = await supabase
        .from('beds')
        .delete()
        .eq('id', bedId);

      if (error) throw error;

      // Update ward bed count
      if (bed?.ward_id) {
        await this.updateWardBedCount(bed.ward_id);
      }

      return { error: null };
    } catch (error) {
      console.error('Error deleting bed:', error);
      return { error };
    }
  }

  async deleteRoom(wardId: string, roomNumber: string) {
    try {
      // Check if any beds in the room are occupied
      const { data: beds } = await supabase
        .from('beds')
        .select('status')
        .eq('ward_id', wardId)
        .eq('room_number', roomNumber);

      const hasOccupiedBeds = beds?.some(bed => bed.status === 'occupied');
      if (hasOccupiedBeds) {
        throw new Error('Cannot delete room with occupied beds');
      }

      const { error } = await supabase
        .from('beds')
        .delete()
        .eq('ward_id', wardId)
        .eq('room_number', roomNumber);

      if (error) throw error;

      // Update ward bed count
      await this.updateWardBedCount(wardId);

      return { error: null };
    } catch (error) {
      console.error('Error deleting room:', error);
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

  // ==================== STATISTICS ====================

  async getDepartmentWardStatistics(departmentId: string) {
    try {
      const { data: wards } = await this.getWardsByDepartment(departmentId);

      const stats = {
        totalWards: wards?.length || 0,
        totalBeds: wards?.reduce((sum, w) => sum + (w.total_beds || 0), 0) || 0,
        occupiedBeds: wards?.reduce((sum, w) => sum + (w.occupied_beds || 0), 0) || 0,
        availableBeds: 0,
        totalRooms: 0  // We'll calculate this from beds later
      };

      stats.availableBeds = stats.totalBeds - stats.occupiedBeds;

      return { data: stats, error: null };
    } catch (error) {
      console.error('Error getting department statistics:', error);
      return { data: null, error };
    }
  }
}

export const wardManagementService = new WardManagementService();