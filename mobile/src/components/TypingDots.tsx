import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface Props {
  color: string;
}

/** Three pulsing dots shown while the assistant has not produced text yet. */
export function TypingDots({ color }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 3,
        duration: 1200,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <View style={styles.row} accessibilityLabel="Assistant is replying">
      {[0, 1, 2].map((index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: color,
              opacity: progress.interpolate({
                inputRange: [index - 0.6, index, index + 0.6, index + 1],
                outputRange: [0.25, 1, 0.25, 0.25],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});
