import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Dimensions,
  Animated,
  PanResponder,
  Platform,
  Image,
  Modal,
  SafeAreaView,
  ImageSourcePropType,
  ImageResizeMode,
  PanResponderInstance,
} from 'react-native';

import { IOnTap, IOnMove } from '../types';

const WINDOW_WIDTH: number = Dimensions.get('window').width;
const WINDOW_HEIGHT: number = Dimensions.get('window').height;
const STATUS_BAR_OFFSET: number = Platform.OS === 'ios' ? 0 : -25;
const LONG_PRESS_TIME: number = 800;
const DOUBLE_CLICK_INTERVAL: number = 250;
const MAX_OVERFLOW: number = 100;
const MIN_SCALE: number = 0.6;
const MAX_SCALE: number = 10;
const CLICK_DISTANCE: number = 10;
const DRAG_DISMISS_THRESHOLD: number = 150;

const Styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    backgroundColor: 'transparent',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: WINDOW_WIDTH,
    backgroundColor: 'transparent',
  },
  closeButton: {
    fontSize: 35,
    color: 'white',
    lineHeight: 40,
    width: 40,
    textAlign: 'center',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 1.5,
    shadowColor: 'black',
    shadowOpacity: 0.8,
  },
});

interface Props {
  isOpen: boolean;
  origin: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  source: ImageSourcePropType;
  resizeMode?: ImageResizeMode;
  backgroundColor?: string;
  swipeToDismiss?: boolean;
  renderHeader?: (close: () => void) => JSX.Element | Array<JSX.Element>;
  renderFooter?: (close: () => void) => JSX.Element | Array<JSX.Element>;
  onTap?: (eventParams: IOnTap) => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  didOpen?: () => void;
  onMove?: (position: IOnMove) => void;
  responderRelease?: (vx?: number, scale?: number) => void;
  willClose?: () => void;
  onClose: () => void;
}
export default class ImageDetail extends React.Component<Props> {
  private _animatedScale = new Animated.Value(1);
  private _animatedPositionX = new Animated.Value(0);
  private _animatedPositionY = new Animated.Value(0);
  private _animatedFrame = new Animated.Value(0);
  private _animatedOpacity = new Animated.Value(WINDOW_HEIGHT);
  private _imagePanResponder?: PanResponderInstance = undefined;

  private _lastPositionX: null | number = null;
  private _lastPositionY: null | number = null;
  private _zoomLastDistance: null | number = null;
  private _horizontalWholeCounter: number = 0;
  private _verticalWholeCounter: number = 0;
  private _isDoubleClick: boolean = false;
  private _isLongPress: boolean = false;
  private _centerDiffX: number = 0;
  private _centerDiffY: number = 0;
  private _singleClickTimeout: undefined | number = undefined;
  private _longPressTimeout: undefined | number = undefined;
  private _lastClickTime: number = 0;
  private _doubleClickX: number = 0;
  private _doubleClickY: number = 0;
  private _scale: number = 1;
  private _positionX: number = 0;
  private _positionY: number = 0;
  private _zoomCurrentDistance: number = 0;
  private _swipeDownOffset: number = 0;
  private _horizontalWholeOuterCounter: number = 0;
  private _isAnimated: boolean = false;
  private _target = {
    x: 0,
    y: 0,
    opacity: 1,
  };

  constructor(props: Props) {
    super(props);

    const {
      onLongPress,
      onDoubleTap,
      swipeToDismiss,
      onTap,
      responderRelease,
    } = props;
    this._imagePanResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: evt => {
        if (this._isAnimated) {
          return;
        }
        this._lastPositionX = null;
        this._lastPositionY = null;
        this._zoomLastDistance = null;
        this._horizontalWholeCounter = 0;
        this._verticalWholeCounter = 0;
        this._isDoubleClick = false;
        this._isLongPress = false;

        if (this._singleClickTimeout) {
          clearTimeout(this._singleClickTimeout);
        }

        if (evt.nativeEvent.changedTouches.length > 1) {
          const centerX =
            (evt.nativeEvent.changedTouches[0].pageX +
              evt.nativeEvent.changedTouches[1].pageX) /
            2;
          this._centerDiffX = centerX - WINDOW_WIDTH / 2;

          const centerY =
            (evt.nativeEvent.changedTouches[0].pageY +
              evt.nativeEvent.changedTouches[1].pageY) /
            2;
          this._centerDiffY = centerY - WINDOW_HEIGHT / 2;
        }
        if (this._longPressTimeout) {
          clearTimeout(this._longPressTimeout);
        }
        this._longPressTimeout = setTimeout(() => {
          this._isLongPress = true;
          if (typeof onLongPress === 'function') {
            onLongPress();
          }
        }, LONG_PRESS_TIME);

        if (evt.nativeEvent.changedTouches.length <= 1) {
          if (
            new Date().getTime() - this._lastClickTime <
            (DOUBLE_CLICK_INTERVAL || 0)
          ) {
            this._lastClickTime = 0;
            if (typeof onDoubleTap === 'function') {
              onDoubleTap();
            }

            clearTimeout(this._longPressTimeout);

            this._doubleClickX = evt.nativeEvent.changedTouches[0].pageX;
            this._doubleClickY = evt.nativeEvent.changedTouches[0].pageY;

            this._isDoubleClick = true;

            if (this._scale > 1 || this._scale < 1) {
              this._scale = 1;

              this._positionX = 0;
              this._positionY = 0;
            } else {
              const beforeScale = this._scale;
              this._scale = 2;

              const diffScale = this._scale - beforeScale;
              this._positionX =
                ((WINDOW_WIDTH / 2 - this._doubleClickX) * diffScale) /
                this._scale;

              this._positionY =
                ((WINDOW_HEIGHT / 2 - this._doubleClickY) * diffScale) /
                this._scale;
            }

            this._imageDidMove('centerOn');

            Animated.parallel([
              Animated.timing(this._animatedScale, {
                toValue: this._scale,
                duration: 100,
              }),
              Animated.timing(this._animatedPositionX, {
                toValue: this._positionX,
                duration: 100,
              }),
              Animated.timing(this._animatedPositionY, {
                toValue: this._positionY,
                duration: 100,
              }),
            ]).start();
          } else {
            this._lastClickTime = new Date().getTime();
          }
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (this._isDoubleClick || this._isAnimated) {
          return;
        }

        if (evt.nativeEvent.changedTouches.length <= 1) {
          let diffX = gestureState.dx - (this._lastPositionX || 0);
          if (this._lastPositionX === null) {
            diffX = 0;
          }
          let diffY = gestureState.dy - (this._lastPositionY || 0);
          if (this._lastPositionY === null) {
            diffY = 0;
          }

          this._lastPositionX = gestureState.dx;
          this._lastPositionY = gestureState.dy;

          this._horizontalWholeCounter += diffX;
          this._verticalWholeCounter += diffY;

          if (
            (Math.abs(this._horizontalWholeCounter) > 5 ||
              Math.abs(this._verticalWholeCounter) > 5) &&
            this._longPressTimeout
          ) {
            clearTimeout(this._longPressTimeout);
          }

          if (this._swipeDownOffset === 0) {
            if (WINDOW_WIDTH * this._scale > WINDOW_WIDTH) {
              if (this._horizontalWholeOuterCounter > 0) {
                if (diffX < 0) {
                  if (this._horizontalWholeOuterCounter > Math.abs(diffX)) {
                    this._horizontalWholeOuterCounter += diffX;
                    diffX = 0;
                  } else {
                    diffX += this._horizontalWholeOuterCounter;
                    this._horizontalWholeOuterCounter = 0;
                  }
                } else {
                  this._horizontalWholeOuterCounter += diffX;
                }
              } else if (this._horizontalWholeOuterCounter < 0) {
                if (diffX > 0) {
                  if (Math.abs(this._horizontalWholeOuterCounter) > diffX) {
                    this._horizontalWholeOuterCounter += diffX;
                    diffX = 0;
                  } else {
                    diffX += this._horizontalWholeOuterCounter;
                    this._horizontalWholeOuterCounter = 0;
                  }
                } else {
                  this._horizontalWholeOuterCounter += diffX;
                }
              }

              this._positionX += diffX / this._scale;

              const horizontalMax =
                (WINDOW_WIDTH * this._scale - WINDOW_WIDTH) / 2 / this._scale;
              if (this._positionX < -horizontalMax) {
                this._positionX = -horizontalMax;
                this._horizontalWholeOuterCounter += -1 / 1e10;
              } else if (this._positionX > horizontalMax) {
                this._positionX = horizontalMax;
                this._horizontalWholeOuterCounter += 1 / 1e10;
              }
              this._animatedPositionX.setValue(this._positionX);
            } else {
              this._horizontalWholeOuterCounter += diffX;
            }

            if (this._horizontalWholeOuterCounter > (MAX_OVERFLOW || 0)) {
              this._horizontalWholeOuterCounter = MAX_OVERFLOW || 0;
            } else if (
              this._horizontalWholeOuterCounter < -(MAX_OVERFLOW || 0)
            ) {
              this._horizontalWholeOuterCounter = -(MAX_OVERFLOW || 0);
            }
          }

          this._positionY += diffY / this._scale;
          this._animatedPositionY.setValue(this._positionY);
          if (swipeToDismiss && this._scale === 1) {
            this._animatedOpacity.setValue(Math.abs(gestureState.dy));
          }
        } else {
          if (this._longPressTimeout) {
            clearTimeout(this._longPressTimeout);
          }

          let minX: number;
          let maxX: number;
          if (
            evt.nativeEvent.changedTouches[0].locationX >
            evt.nativeEvent.changedTouches[1].locationX
          ) {
            minX = evt.nativeEvent.changedTouches[1].pageX;
            maxX = evt.nativeEvent.changedTouches[0].pageX;
          } else {
            minX = evt.nativeEvent.changedTouches[0].pageX;
            maxX = evt.nativeEvent.changedTouches[1].pageX;
          }

          let minY: number;
          let maxY: number;
          if (
            evt.nativeEvent.changedTouches[0].locationY >
            evt.nativeEvent.changedTouches[1].locationY
          ) {
            minY = evt.nativeEvent.changedTouches[1].pageY;
            maxY = evt.nativeEvent.changedTouches[0].pageY;
          } else {
            minY = evt.nativeEvent.changedTouches[0].pageY;
            maxY = evt.nativeEvent.changedTouches[1].pageY;
          }

          const widthDistance = maxX - minX;
          const heightDistance = maxY - minY;
          const diagonalDistance = Math.sqrt(
            widthDistance * widthDistance + heightDistance * heightDistance
          );
          this._zoomCurrentDistance = Number(diagonalDistance.toFixed(1));

          if (this._zoomLastDistance !== null) {
            const distanceDiff =
              (this._zoomCurrentDistance - this._zoomLastDistance) / 200;
            let zoom = this._scale + distanceDiff;

            if (zoom < MIN_SCALE) {
              zoom = MIN_SCALE;
            }
            if (zoom > MAX_SCALE) {
              zoom = MAX_SCALE;
            }

            const beforeScale = this._scale;

            this._scale = zoom;
            this._animatedScale.setValue(this._scale);

            const diffScale = this._scale - beforeScale;
            this._positionX -= (this._centerDiffX * diffScale) / this._scale;
            this._positionY -= (this._centerDiffY * diffScale) / this._scale;
            this._animatedPositionX.setValue(this._positionX);
            this._animatedPositionY.setValue(this._positionY);
          }
          this._zoomLastDistance = this._zoomCurrentDistance;
        }

        this._imageDidMove('onPanResponderMove');
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (this._longPressTimeout) {
          clearTimeout(this._longPressTimeout);
        }

        if (this._isDoubleClick || this._isLongPress || this._isAnimated) {
          return;
        }

        const moveDistance = Math.sqrt(
          gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy
        );
        const { locationX, locationY, pageX, pageY } = evt.nativeEvent;

        if (
          evt.nativeEvent.changedTouches.length === 1 &&
          moveDistance < CLICK_DISTANCE
        ) {
          this._singleClickTimeout = setTimeout(() => {
            if (typeof onTap === 'function') {
              onTap({ locationX, locationY, pageX, pageY });
            }
          }, DOUBLE_CLICK_INTERVAL);
        } else {
          if (typeof responderRelease === 'function') {
            responderRelease(gestureState.vx, this._scale);
          }

          this._panResponderReleaseResolve(
            evt.nativeEvent.changedTouches.length
          );
        }
      },
      onPanResponderTerminate: () => {},
    });
  }

  private _imageDidMove = (type: string): void => {
    const { onMove } = this.props;
    if (typeof onMove === 'function') {
      onMove({
        type,
        positionX: this._positionX,
        positionY: this._positionY,
        scale: this._scale,
        zoomCurrentDistance: this._zoomCurrentDistance,
      });
    }
  };

  private _panResponderReleaseResolve = (changedTouchesCount: number) => {
    const { swipeToDismiss } = this.props;
    if (this._scale < 1) {
      this._scale = 1;
      Animated.timing(this._animatedScale, {
        toValue: this._scale,
        duration: 100,
      }).start();
    }

    if (WINDOW_WIDTH * this._scale <= WINDOW_WIDTH) {
      this._positionX = 0;
      Animated.timing(this._animatedPositionX, {
        toValue: this._positionX,
        duration: 100,
      }).start();
    }

    if (WINDOW_HEIGHT * this._scale < WINDOW_HEIGHT) {
      this._positionY = 0;
      Animated.timing(this._animatedPositionY, {
        toValue: this._positionY,
        duration: 100,
      }).start();
    } else if (
      swipeToDismiss &&
      this._scale === 1 &&
      changedTouchesCount === 1 &&
      Math.abs(this._positionY) > DRAG_DISMISS_THRESHOLD
    ) {
      this._close();
      return;
    }

    if (WINDOW_HEIGHT * this._scale > WINDOW_HEIGHT) {
      const verticalMax =
        (WINDOW_HEIGHT * this._scale - WINDOW_HEIGHT) / 2 / this._scale;
      if (this._positionY < -verticalMax) {
        this._positionY = -verticalMax;
      } else if (this._positionY > verticalMax) {
        this._positionY = verticalMax;
      }
      Animated.timing(this._animatedPositionY, {
        toValue: this._positionY,
        duration: 100,
      }).start();
    }

    if (WINDOW_WIDTH * this._scale > WINDOW_WIDTH) {
      const horizontalMax =
        (WINDOW_WIDTH * this._scale - WINDOW_WIDTH) / 2 / this._scale;
      if (this._positionX < -horizontalMax) {
        this._positionX = -horizontalMax;
      } else if (this._positionX > horizontalMax) {
        this._positionX = horizontalMax;
      }
      Animated.timing(this._animatedPositionX, {
        toValue: this._positionX,
        duration: 100,
      }).start();
    }

    if (this._scale === 1) {
      this._positionX = 0;
      this._positionY = 0;
      Animated.timing(this._animatedPositionX, {
        toValue: this._positionX,
        duration: 100,
      }).start();
      Animated.timing(this._animatedPositionY, {
        toValue: this._positionY,
        duration: 100,
      }).start();
    }

    Animated.timing(this._animatedOpacity, {
      toValue: 0,
      duration: 100,
    }).start();

    this._horizontalWholeOuterCounter = 0;
    this._swipeDownOffset = 0;

    this._imageDidMove('onPanResponderRelease');
  };

  private _close = () => {
    const { willClose, onClose } = this.props;
    this._isAnimated = true;
    if (willClose) {
      willClose();
    }

    Animated.parallel([
      Animated.timing(this._animatedScale, { toValue: 1 }),
      Animated.timing(this._animatedPositionX, { toValue: 0 }),
      Animated.timing(this._animatedPositionY, { toValue: 0 }),
      Animated.timing(this._animatedOpacity, { toValue: WINDOW_HEIGHT }),
      Animated.spring(this._animatedFrame, { toValue: 0 }),
    ]).start(() => {
      onClose();
      this._isAnimated = false;
    });
  };

  shouldComponentUpdate(nextProps: Props) {
    if (nextProps.isOpen !== this.props.isOpen) {
      return true;
    }
    return false;
  }

  componentDidUpdate() {
    const { isOpen, didOpen } = this.props;

    if (isOpen) {
      this._lastPositionX = null;
      this._lastPositionY = null;
      this._zoomLastDistance = null;
      this._horizontalWholeCounter = 0;
      this._verticalWholeCounter = 0;
      this._isDoubleClick = false;
      this._isLongPress = false;
      this._centerDiffX = 0;
      this._centerDiffY = 0;
      this._singleClickTimeout = undefined;
      this._longPressTimeout = undefined;
      this._lastClickTime = 0;
      this._doubleClickX = 0;
      this._doubleClickY = 0;
      this._scale = 1;
      this._positionX = 0;
      this._positionY = 0;
      this._zoomCurrentDistance = 0;
      this._swipeDownOffset = 0;
      this._horizontalWholeOuterCounter = 0;
      this._isAnimated = true;
      this._target = {
        x: 0,
        y: 0,
        opacity: 1,
      };

      Animated.parallel([
        Animated.timing(this._animatedOpacity, { toValue: 0 }),
        Animated.spring(this._animatedFrame, { toValue: 1 }),
      ]).start(() => {
        this._isAnimated = false;
        if (typeof didOpen === 'function') {
          didOpen();
        }
      });
    }
  }

  render() {
    const {
      isOpen,
      origin,
      source,
      resizeMode,
      backgroundColor = '#000000',
      renderHeader,
      renderFooter,
    } = this.props;

    const animateConf = {
      transform: [
        {
          scale: this._animatedScale,
        },
        {
          translateX: this._animatedPositionX,
        },
        {
          translateY: this._animatedPositionY,
        },
      ],
      left: this._animatedFrame.interpolate({
        inputRange: [0, 1],
        outputRange: [origin.x, this._target.x],
      }),
      top: this._animatedFrame.interpolate({
        inputRange: [0, 1],
        outputRange: [
          origin.y + STATUS_BAR_OFFSET,
          this._target.y + STATUS_BAR_OFFSET,
        ],
      }),
      width: this._animatedFrame.interpolate({
        inputRange: [0, 1],
        outputRange: [origin.width, WINDOW_WIDTH],
      }),
      height: this._animatedFrame.interpolate({
        inputRange: [0, 1],
        outputRange: [origin.height, WINDOW_HEIGHT],
      }),
    };

    const background = (
      <Animated.View
        style={[
          Styles.background,
          { backgroundColor: backgroundColor },
          {
            opacity: this._animatedOpacity.interpolate({
              inputRange: [0, WINDOW_HEIGHT],
              outputRange: [1, 0],
            }),
          },
        ]}></Animated.View>
    );

    const header = (
      <Animated.View
        style={[
          Styles.header,
          {
            opacity: this._animatedOpacity.interpolate({
              inputRange: [0, WINDOW_HEIGHT],
              outputRange: [1, 0],
            }),
          },
        ]}>
        {renderHeader ? (
          renderHeader(this._close)
        ) : (
          <SafeAreaView>
            <TouchableOpacity onPress={this._close}>
              <Text style={Styles.closeButton}>×</Text>
            </TouchableOpacity>
          </SafeAreaView>
        )}
      </Animated.View>
    );

    const footer = renderFooter && (
      <Animated.View
        style={[
          Styles.footer,
          {
            opacity: this._animatedOpacity.interpolate({
              inputRange: [0, WINDOW_HEIGHT],
              outputRange: [1, 0],
            }),
          },
        ]}>
        {renderFooter(this._close)}
      </Animated.View>
    );

    const content = (
      <View
        style={{
          overflow: 'hidden',
          width: WINDOW_WIDTH,
          height: WINDOW_HEIGHT,
        }}
        {...this._imagePanResponder!.panHandlers}>
        {background}
        <Animated.View
          style={animateConf}
          renderToHardwareTextureAndroid={true}>
          <Image
            resizeMode={resizeMode}
            style={{
              width: '100%',
              height: '100%',
            }}
            source={source}
          />
        </Animated.View>
        {header}
        {footer}
      </View>
    );

    return (
      <Modal
        visible={isOpen}
        transparent={true}
        onRequestClose={() => this._close()}>
        {content}
      </Modal>
    );
  }
}
