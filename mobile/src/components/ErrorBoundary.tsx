import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { logEvent } from '../utils/logger';
import { spacing, ThemeColors, typography, useThemeStyles } from '../theme';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// The fallback is split out as a function component because the boundary itself must stay a
// class (only classes can catch render errors) and hooks are illegal there.
function ErrorFallback({ message, onRetry }: { message: string; onRetry: () => void }) {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      <PrimaryButton title="Try again" onPress={onRetry} />
    </View>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logEvent('render_error', error.message, { stack: error.stack, componentStack: info.componentStack }, 'error');
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback message={this.state.error.message} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      backgroundColor: c.background,
    },
    title: {
      ...typography.heading,
      color: c.text,
      marginBottom: spacing.sm,
    },
    message: {
      ...typography.caption,
      color: c.textMuted,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
  });
