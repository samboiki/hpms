# Telemedicine Integration Guide for HPMS

## Quick Start Implementation

### Option 1: Jitsi Meet (FREE)

```typescript
// 1. Install dependencies (optional for advanced features)
npm install @jitsi/react-sdk

// 2. Basic implementation
const startTelemedicine = (appointmentId: string) => {
  const roomName = `hpms-${practiceId}-${appointmentId}`;
  const domain = 'meet.jit.si';
  
  const options = {
    roomName: roomName,
    width: '100%',
    height: 700,
    parentNode: document.querySelector('#jitsi-container'),
    userInfo: {
      displayName: user.name,
      email: user.email
    },
    configOverwrite: {
      startWithAudioMuted: true,
      startWithVideoMuted: false,
      disableModeratorIndicator: true,
      disableReactions: true
    },
    interfaceConfigOverwrite: {
      SHOW_JITSI_WATERMARK: false,
      TOOLBAR_BUTTONS: [
        'microphone', 'camera', 'desktop', 'fullscreen',
        'fodeviceselection', 'hangup', 'chat', 'recording',
        'livestreaming', 'settings', 'videoquality'
      ],
    }
  };
  
  const api = new JitsiMeetExternalAPI(domain, options);
  
  // Event handlers
  api.addEventListener('videoConferenceJoined', () => {
    console.log('User has joined the meeting');
  });
  
  api.addEventListener('videoConferenceLeft', () => {
    console.log('User has left the meeting');
    api.dispose();
  });
};
```

### Option 2: Daily.co (Recommended)

```typescript
// 1. Install
npm install @daily-co/daily-react

// 2. Create room via API
const createDailyRoom = async (appointmentId: string) => {
  const response = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DAILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `appointment-${appointmentId}`,
      privacy: 'private',
      properties: {
        enable_recording: true,
        enable_chat: true,
        exp: Math.round(Date.now() / 1000) + 3600, // 1 hour expiry
      }
    })
  });
  
  const room = await response.json();
  return room.url;
};

// 3. React Component
import DailyIframe from '@daily-co/daily-react';

const TelemedicineSession = ({ roomUrl }) => {
  return (
    <DailyIframe
      url={roomUrl}
      style={{ width: '100%', height: '100%' }}
      showLeaveButton={true}
      showFullscreenButton={true}
    />
  );
};
```

### Option 3: Whereby Embedded

```typescript
// Simplest implementation - just an iframe
const WherebyRoom = ({ roomUrl, displayName }) => {
  return (
    <iframe
      src={`${roomUrl}?displayName=${displayName}&audio=on&video=on&screenshare=on`}
      allow="camera; microphone; fullscreen; display-capture"
      style={{ width: '100%', height: '700px', border: '0' }}
    />
  );
};
```

## Database Schema for Telemedicine

```sql
-- Add to your Supabase migrations
CREATE TABLE telemedicine_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID REFERENCES appointments(id),
  room_url TEXT NOT NULL,
  room_name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'jitsi', 'daily', 'whereby', etc.
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  recording_url TEXT,
  patient_joined BOOLEAN DEFAULT FALSE,
  doctor_joined BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Track session events
CREATE TABLE telemedicine_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES telemedicine_sessions(id),
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL, -- 'joined', 'left', 'muted', 'unmuted', etc.
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);
```

## Integration with HPMS

```typescript
// In your appointments or visits component
const startTelemedicineSession = async (appointmentId: string) => {
  try {
    // 1. Create room (example with Daily.co)
    const roomUrl = await createDailyRoom(appointmentId);
    
    // 2. Save to database
    const { data: session } = await supabase
      .from('telemedicine_sessions')
      .insert({
        appointment_id: appointmentId,
        room_url: roomUrl,
        room_name: `appointment-${appointmentId}`,
        provider: 'daily'
      })
      .select()
      .single();
    
    // 3. Navigate to telemedicine room
    navigate(`/telemedicine/${session.id}`);
    
    // 4. Send invite to patient
    await communicationService.sendSMS({
      practiceId: user.practice_id,
      recipientPhone: patient.phone,
      messageContent: `Your telemedicine appointment is ready. Join here: ${roomUrl}`,
      messageType: 'telemedicine_invite',
      patientId: patient.id,
      appointmentId: appointmentId
    });
    
  } catch (error) {
    console.error('Failed to start telemedicine:', error);
    toast.error('Failed to start video call');
  }
};
```

## Mobile App Considerations

### React Native Integration

```typescript
// For Jitsi in React Native
npm install react-native-jitsi-meet

// Usage
import JitsiMeet, { JitsiMeetView } from 'react-native-jitsi-meet';

const TelemedicineScreen = ({ route }) => {
  const { roomUrl, userInfo } = route.params;
  
  useEffect(() => {
    const url = roomUrl;
    const userInfo = {
      displayName: 'Dr. Smith',
      email: 'dr.smith@clinic.com',
      avatar: 'https://avatar.url',
    };
    
    JitsiMeet.call(url, userInfo);
  }, []);
  
  return <JitsiMeetView style={{ flex: 1 }} />;
};
```

### Flutter Integration

```dart
// For Flutter
dependencies:
  jitsi_meet_flutter_plugin: ^2.0.0

// Usage
import 'package:jitsi_meet_flutter_plugin/jitsi_meet.dart';

void _joinMeeting() async {
  try {
    var options = JitsiMeetingOptions(room: roomName)
      ..userDisplayName = "Dr. Smith"
      ..userEmail = "dr.smith@clinic.com"
      ..audioMuted = true
      ..videoMuted = false;
      
    await JitsiMeet.joinMeeting(options);
  } catch (error) {
    print("Error: $error");
  }
}
```

## HIPAA Compliance Considerations

1. **Use HIPAA-compliant providers**:
   - Daily.co (with BAA)
   - Twilio (with BAA)
   - Agora (with BAA)

2. **Security measures**:
   - End-to-end encryption
   - Secure room URLs (not guessable)
   - Time-limited access
   - Waiting rooms for patient verification

3. **Data handling**:
   - Don't store recordings without consent
   - Log access for audit trails
   - Implement proper authentication

## Cost Comparison

| Provider | Free Tier | Paid Plans | Best For |
|----------|-----------|------------|----------|
| Jitsi | Unlimited | Self-host | Budget-conscious |
| Daily.co | 10k min/mo | $0.004/min | Balance of features |
| Whereby | 100 min/mo | $9.99/mo | Simple setup |
| Agora | 10k min/mo | $0.99/1000 min | Scale |
| 100ms | 10k min/mo | $0.004/min | Developer-friendly |
| Twilio | None | $0.01/min | Enterprise |

## Recommended Implementation Steps

1. **Start with Jitsi** for proof of concept (free, immediate)
2. **Move to Daily.co** for production (better features, still affordable)
3. **Consider Twilio** only if you need strict HIPAA compliance

## Support & Documentation

- Jitsi: https://jitsi.github.io/handbook/docs/dev-guide/
- Daily.co: https://docs.daily.co/
- Agora: https://docs.agora.io/
- 100ms: https://docs.100ms.live/
- Twilio: https://www.twilio.com/docs/video