package com.qipz.iku;

public enum MonitoringMode {
  QUIET(0),
  MANUAL(1),
  SIGNIFICANT(2),
  MOVE(3);

  private final int value;

  MonitoringMode(int value) {
    this.value = value;
  }

  public int getValue() {
    return value;
  }

  public static MonitoringMode fromValue(int value) {
    for (MonitoringMode mode : values()) {
      if (mode.value == value) {
        return mode;
      }
    }
    return MOVE;
  }

  public MonitoringMode next() {
    int index = (ordinal() + 1) % values().length;
    return values()[index];
  }
}

