import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  @override
  List<Object?> get props => [];
}

class AuthCheckRequested extends AuthEvent {}

class AuthAutoLoginRequested extends AuthEvent {}

class AuthLogoutRequested extends AuthEvent {}

abstract class AuthState extends Equatable {
  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {}
class AuthLoading extends AuthState {}
class AuthAuthenticated extends AuthState {
  final String token;
  
  AuthAuthenticated({required this.token});
  
  @override
  List<Object?> get props => [token];
}
class AuthUnauthenticated extends AuthState {}
class AuthError extends AuthState {
  final String message;
  
  AuthError({required this.message});
  
  @override
  List<Object?> get props => [message];
}