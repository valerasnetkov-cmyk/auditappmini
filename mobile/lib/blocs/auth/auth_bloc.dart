import 'package:flutter_bloc/flutter_bloc.dart';
import '../../api_client.dart';
import 'auth_event.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc() : super(AuthInitial()) {
    on<AuthCheckRequested>(_onCheckAuthStatus);
    on<AuthAutoLoginRequested>(_onAutoLoginRequested);
    on<AuthLogoutRequested>(_onLogoutRequested);
  }
  
  Future<void> _onCheckAuthStatus(
    AuthCheckRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    
    // Check for stored token
    if (api.token != null && api.token!.isNotEmpty) {
      emit(AuthAuthenticated(token: api.token!));
    } else {
      // Auto-login without password
      add(AuthAutoLoginRequested());
    }
  }
  
  Future<void> _onAutoLoginRequested(
    AuthAutoLoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    try {
      final response = await api.login('', '');
      
      if (response['token'] != null) {
        emit(AuthAuthenticated(token: response['token']));
      } else {
        emit(AuthUnauthenticated());
      }
    } catch (e) {
      emit(AuthError(message: e.toString()));
    }
  }
  
  Future<void> _onLogoutRequested(
    AuthLogoutRequested event,
    Emitter<AuthState> emit,
  ) async {
    await api.logout();
    emit(AuthUnauthenticated());
  }
}