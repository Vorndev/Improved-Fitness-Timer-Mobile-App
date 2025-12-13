import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
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

export default function TimerPage() {
  // Timer settings
  const [mainTimerMinutes, setMainTimerMinutes] = useState(1);
  const [mainTimerSeconds, setMainTimerSeconds] = useState(30);
  const [getReadyMinutes, setGetReadyMinutes] = useState(0);
  const [getReadySeconds, setGetReadySeconds] = useState(5);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(90); // in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [getReadyPlayed, setGetReadyPlayed] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longBeepCountRef = useRef(0);

  // Calculate total times
  const totalTime = mainTimerMinutes * 60 + mainTimerSeconds;
  const getReadyTime = getReadyMinutes * 60 + getReadySeconds;

  // Audio players for beep sounds
  const shortBeepPlayer = useAudioPlayer(require('../../assets/sounds/beep.wav'));
  const longBeepPlayer = useAudioPlayer(require('../../assets/sounds/beep.wav'));

  // Load saved timer values on component mount
  useEffect(() => {
    const loadTimerValues = async () => {
      try {
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
        console.warn('Error loading timer values:', error);
      }
    };

    loadTimerValues();
  }, []);

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
      shortBeepPlayer.seekTo(0);
      shortBeepPlayer.play();
    } catch (error) {
      console.warn('Error playing short beep:', error);
    }
  };

  const playLongBeep = () => {
    try {
      longBeepCountRef.current = 0;

      const playBeep = () => {
        longBeepPlayer.seekTo(0);
        longBeepPlayer.play();
      };

      // Play first beep
      playBeep();

      // Set up a listener for when playback finishes
      const checkFinished = setInterval(() => {
        if (!longBeepPlayer.playing && longBeepPlayer.currentTime === 0 && longBeepCountRef.current < 3) {
          longBeepCountRef.current += 1;

          if (longBeepCountRef.current < 3) {
            playBeep();
          } else {
            clearInterval(checkFinished);
          }
        }
      }, 100);

      // Cleanup after max time (safety measure)
      setTimeout(() => {
        clearInterval(checkFinished);
      }, 5000);
    } catch (error) {
      console.warn('Error playing long beep:', error);
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
              />
              <Text style={styles.inputLabel}>min</Text>
              <TextInput
                style={styles.input}
                value={mainTimerSeconds.toString()}
                onChangeText={(text) => setMainTimerSeconds(Math.min(59, parseInt(text) || 0))}
                keyboardType="number-pad"
                maxLength={2}
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
              />
              <Text style={styles.inputLabel}>min</Text>
              <TextInput
                style={styles.input}
                value={getReadySeconds.toString()}
                onChangeText={(text) => setGetReadySeconds(Math.min(59, parseInt(text) || 0))}
                keyboardType="number-pad"
                maxLength={2}
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
