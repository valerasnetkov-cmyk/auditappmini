import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import LoginScreen from '../screens/LoginScreen'
import DashboardScreen from '../screens/DashboardScreen'
import DefectsScreen from '../screens/DefectsScreen'
import DefectDetailScreen from '../screens/DefectDetailScreen'
import RegistrationScreen from '../screens/RegistrationScreen'
import MfaScreen from '../screens/MfaScreen'
// import React and hooks already imported
import { createNavigationContainerRef } from '@react-navigation/native'
import { setLogoutCallback } from '../api/api'

type RootStackParamList = {
  Login: undefined
  Dashboard: undefined
  Defects: undefined
  DefectDetail: { id: string }
}

const Stack = createStackNavigator<RootStackParamList>()
const navigationRef = createNavigationContainerRef()

export default function AppNavigator() {
  useEffect(() => {
    // Expose a global logout redirect for any 401s from API
    setLogoutCallback(() => {
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] })
      }
    })
  }, [])
  // Simple placeholder; in real app, check auth state to decide initial route
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Defects" component={DefectsScreen} />
        <Stack.Screen name="DefectDetail" component={DefectDetailScreen} />
        <Stack.Screen name="Register" component={RegistrationScreen} />
        <Stack.Screen name="Mfa" component={MfaScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
