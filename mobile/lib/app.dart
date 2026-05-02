import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/inspection/inspection_screen.dart';
import 'screens/inspection/checklist_screen.dart';
import 'screens/inspection/photo_capture_screen.dart';
import 'screens/vehicle/vehicle_detail_screen.dart';
import 'blocs/auth/auth_bloc.dart';
import 'blocs/auth/auth_event.dart';

class AuditApp extends StatelessWidget {
  const AuditApp({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => AuthBloc()..add(AuthCheckRequested()),
      child: MaterialApp(
        title: 'Аудит Техники',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          primarySwatch: Colors.blue,
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: Colors.blue,
            brightness: Brightness.light,
          ),
        ),
        home: BlocBuilder<AuthBloc, AuthState>(
          builder: (context, state) {
            if (state is AuthLoading) {
              return const SplashScreen();
            }
            if (state is AuthAuthenticated) {
              return const HomeScreen();
            }
            return const LoginScreen();
          },
        ),
        routes: {
          '/login': (context) => const LoginScreen(),
          '/home': (context) => const HomeScreen(),
          '/inspection': (context) => const InspectionScreen(),
          '/checklist': (context) => const ChecklistScreen(),
          '/photo': (context) {
            final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
            return PhotoCaptureScreen(
              defectTitle: args?['defectTitle'],
            );
          },
          '/vehicle': (context) {
            final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
            return VehicleDetailScreen(vehicleId: args?['vehicleId']);
          },
        },
      ),
    );
  }
}
