import Svg, { Path, Rect } from "react-native-svg";

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel="Largis Venture">
      <Rect width={32} height={32} rx={4} fill="#0a1628" />
      <Path d="M5 5h6v16h16v6H5z" fill="#ffffff" />
      <Rect x={17} y={5} width={10} height={10} fill="#7b8ef0" />
    </Svg>
  );
}
