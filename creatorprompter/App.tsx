import React from "react";
import { StatusBar } from "react-native";

import MainScreen from "./src/screens/MainScreen";

export default function App() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <MainScreen />
    </>
  );
}
