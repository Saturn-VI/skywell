import type { Component } from 'solid-js';
import type { DevSkywellDefs, DevSkywellFile, DevSkywellGetActorFiles, DevSkywellGetActorProfile } from 'skywell';

import logo from './logo.svg';
import styles from './App.module.css';

import Header from './Header.tsx';
import Sidebar from './Sidebar.tsx';
import Body from './Body.tsx';

const App: Component = () => {
  return (
    <div class="flex flex-col h-screen">
      <Header></Header>
      <div class="flex flex-row h-full">
        <Sidebar></Sidebar>
        <Body></Body>
      </div>
    </div>
  );
};

export default App;
