import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useAudioPlayer, setAudioModeAsync, AudioMode } from 'expo-audio';
import Svg, { Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Storage keys for persisting timer values
const STORAGE_KEYS = {
  MAIN_TIMER_MINUTES: '@timer_main_minutes',
  MAIN_TIMER_SECONDS: '@timer_main_seconds',
  GET_READY_MINUTES: '@timer_get_ready_minutes',
  GET_READY_SECONDS: '@timer_get_ready_seconds',
};

// Audio volume settings (0.0 to 1.0, where 1.0 = 100% of device volume)
const GET_READY_VOLUME = 0.8;  // Volume for get ready beep
const TIMER_DING_VOLUME = 1.0; // Volume for timer completion ding

export default function TimerPage() {
  // Timer settings
  const [mainTimerMinutes, setMainTimerMinutes] = useState(1);
  const [mainTimerSeconds, setMainTimerSeconds] = useState(0);
  const [getReadyMinutes, setGetReadyMinutes] = useState(0);
  const [getReadySeconds, setGetReadySeconds] = useState(5);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(60); // in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [getReadyPlayed, setGetReadyPlayed] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate total times
  const totalTime = mainTimerMinutes * 60 + mainTimerSeconds;
  const getReadyTime = getReadyMinutes * 60 + getReadySeconds;

  // Audio players for timer sounds
  const getReadyPlayer = useAudioPlayer(require('../../assets/sounds/getReadyTimer.wav'));
  const timerDingPlayer = useAudioPlayer(require('../../assets/sounds/timerDing.wav'));

  // Configure audio mode and load saved timer values on component mount
  useEffect(() => {
    const setupAudioAndLoadValues = async () => {
      try {
        // Configure audio to mix with other apps (like Spotify)
        // This allows timer sounds to play over music without stopping it
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false,
        });

        // Load saved timer values
        const [savedMainMinutes, savedMainSeconds, savedGetReadyMinutes, savedGetReadySeconds] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.MAIN_TIMER_MINUTES),
          AsyncStorage.getItem(STORAGE_KEYS.MAIN_TIMER_SECONDS),
          AsyncStorage.getItem(STORAGE_KEYS.GET_READY_MINUTES),
          AsyncStorage.getItem(STORAGE_KEYS.GET_READY_SECONDS),
        ]);

        if (savedMainMinutes !== null) setMainTimerMinutes(parseInt(savedMainMinutes));
        if (savedMainSeconds !== null) setMainTimerSeconds(parseInt(savedMainSeconds));
        if (savedGetReadyMinutes !== null) setGetReadyMinutes(parseInt(savedGetReadyMinutes));
        if (savedGetReadySeconds !== null) setGetReadySeconds(parseInt(savedGetReadySeconds));
      } catch (error) {
        console.warn('Error setting up audio or loading timer values:', error);
      }
    };

    setupAudioAndLoadValues();
  }, []);

  // Update timeLeft when totalTime changes (but only if timer is not running)
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(totalTime);
    }
  }, [totalTime, isRunning]);

  // Note: expo-audio handles audio configuration automatically

  // Timer logic
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0) {
            playLongBeep();
            setIsRunning(false);
            setIsPaused(false);
            setGetReadyPlayed(false);
            return 0;
          }

          // Check if we should play get ready beep
          if (prev === getReadyTime && !getReadyPlayed) {
            playShortBeep();
            setGetReadyPlayed(true);
          }

          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused, getReadyTime, getReadyPlayed]);

  // Save timer values whenever they change
  useEffect(() => {
    const saveTimerValues = async () => {
      try {
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.MAIN_TIMER_MINUTES, mainTimerMinutes.toString()),
          AsyncStorage.setItem(STORAGE_KEYS.MAIN_TIMER_SECONDS, mainTimerSeconds.toString()),
          AsyncStorage.setItem(STORAGE_KEYS.GET_READY_MINUTES, getReadyMinutes.toString()),
          AsyncStorage.setItem(STORAGE_KEYS.GET_READY_SECONDS, getReadySeconds.toString()),
        ]);
      } catch (error) {
        console.warn('Error saving timer values:', error);
      }
    };

    saveTimerValues();
  }, [mainTimerMinutes, mainTimerSeconds, getReadyMinutes, getReadySeconds]);

  // Sound functions using expo-audio
  const playShortBeep = () => {
    try {
      getReadyPlayer.volume = GET_READY_VOLUME;
      getReadyPlayer.seekTo(0);
      getReadyPlayer.play();
    } catch (error) {
      console.warn('Error playing get ready beep:', error);
    }
  };

  const playLongBeep = () => {
    try {
      timerDingPlayer.volume = TIMER_DING_VOLUME;
      timerDingPlayer.seekTo(0);
      timerDingPlayer.play();
    } catch (error) {
      console.warn('Error playing timer ding:', error);
    }
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Button handlers
  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isRunning) {
      setTimeLeft(totalTime);
      setIsRunning(true);
      setIsPaused(false);
      setGetReadyPlayed(false);
    } else if (isPaused) {
      setIsPaused(false);
    } else {
      setIsPaused(true);
    }
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeLeft(totalTime);
    setIsRunning(false);
    setIsPaused(false);
    setGetReadyPlayed(false);
    setModalVisible(false);
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(false);
  };

  // Circle calculations
  const size = 300;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0;
  const strokeDashoffset = circumference - progress * circumference;

  // Get ready line angle (in degrees, 0 is top, clockwise)
  const getReadyAngle = totalTime > 0 ? ((totalTime - getReadyTime) / totalTime) * 360 : 0;
  const getReadyRadians = ((getReadyAngle - 90) * Math.PI) / 180;
  const lineLength = 15;
  const lineX1 = size / 2 + (radius - lineLength / 2) * Math.cos(getReadyRadians);
  const lineY1 = size / 2 + (radius - lineLength / 2) * Math.sin(getReadyRadians);
  const lineX2 = size / 2 + (radius + lineLength / 2) * Math.cos(getReadyRadians);
  const lineY2 = size / 2 + (radius + lineLength / 2) * Math.sin(getReadyRadians);

  return (
    <View style={styles.container}>
      {/* Timer Circle */}
      <View style={styles.circleContainer}>
        <Svg width={size} height={size}>
          <Defs>
            {/* Orange to Red gradient for progress circle */}
            <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FF8C00" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FF0000" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#333333ff"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#progressGradient)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
          {/* Purple get ready line */}
          {getReadyTime > 0 && getReadyTime < totalTime && (
            <Line
              x1={lineX1}
              y1={lineY1}
              x2={lineX2}
              y2={lineY2}
              stroke="#ffffffff"
              strokeWidth={4}
              strokeLinecap="round"
            />
          )}
        </Svg>
        <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
      </View>

      {/* Buttons */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleEdit}
        disabled={isRunning && !isPaused}
      >
        <View style={styles.editButton}>
          <Text style={styles.buttonText}>Edit</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={handleStart}
      >
        <View style={styles.startButton}>
          <Text style={styles.buttonText}>
            {!isRunning ? 'Start' : isPaused ? 'Resume' : 'Pause'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Timers</Text>

            {/* Main Timer */}
            <Text style={styles.label}>Timer</Text>
            <View style={styles.timeInputRow}>
              <TextInput
                style={styles.input}
                value={mainTimerMinutes.toString()}
                onChangeText={(text) => setMainTimerMinutes(parseInt(text) || 0)}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus={true}
              />
              <Text style={styles.inputLabel}>min</Text>
              <TextInput
                style={styles.input}
                value={mainTimerSeconds.toString()}
                onChangeText={(text) => setMainTimerSeconds(Math.min(59, parseInt(text) || 0))}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus={true}
              />
              <Text style={styles.inputLabel}>sec</Text>
            </View>

            {/* Get Ready Timer */}
            <Text style={styles.label}>Get Ready Timer</Text>
            <View style={styles.timeInputRow}>
              <TextInput
                style={styles.input}
                value={getReadyMinutes.toString()}
                onChangeText={(text) => setGetReadyMinutes(parseInt(text) || 0)}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus={true}
              />
              <Text style={styles.inputLabel}>min</Text>
              <TextInput
                style={styles.input}
                value={getReadySeconds.toString()}
                onChangeText={(text) => setGetReadySeconds(Math.min(59, parseInt(text) || 0))}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus={true}
              />
              <Text style={styles.inputLabel}>sec</Text>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancel}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#000000',
  },
  circleContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 200,
  },
  timerText: {
    position: 'absolute',
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  button: {
    width: 280,
    height: 65,
    borderRadius: 32,
    marginVertical: 5,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#2e2e2eff',
  },
  editButton: {
    backgroundColor: '#333333ff',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  startButton: {
    backgroundColor: '#15a3dbff',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 30,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 15,
    marginBottom: 8,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#333333',
    color: '#FFFFFF',
    fontSize: 18,
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
    width: 60,
    marginHorizontal: 5,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    marginRight: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  modalButton: {
    flex: 1,
    height: 45,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
    borderWidth: 3,
    borderColor: '#2e2e2eff',
  },
  cancelButton: {
    backgroundColor: '#333333ff',
  },
  saveButton: {
    backgroundColor: '#15a3dbff',
  },
});
