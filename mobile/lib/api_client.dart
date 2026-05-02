import 'dart:convert';
import 'package:http/http.dart' as http;
import 'config.dart';

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  
  @override
  String toString() => message;
}

class ApiClient {
  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  String? get token => _token;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/auth/login'),
      headers: _headers,
      body: jsonEncode({'email': email, 'password': password}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      _token = data['token'];
      return data;
    } else {
      throw ApiException(data['error'] ?? 'Login failed');
    }
  }

  Future<void> logout() async {
    _token = null;
  }

  // Vehicles
  Future<List<dynamic>> getVehicles({int page = 1, int limit = 20, String? search, String? status}) async {
    final query = Uri(queryParameters: {
      'page': page.toString(),
      'limit': limit.toString(),
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status != 'all') 'status': status,
    });

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/vehicles$query'),
      headers: _headers,
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data['data'] ?? [];
    } else {
      throw ApiException(data['error'] ?? 'Failed to load vehicles');
    }
  }

  Future<List<dynamic>> getVehiclesList() async {
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/vehicles/list'),
      headers: _headers,
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data['data'] ?? [];
    } else {
      throw ApiException(data['error'] ?? 'Failed to load vehicles');
    }
  }

  Future<Map<String, dynamic>> getVehicle(String id) async {
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/vehicles/$id'),
      headers: _headers,
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data;
    } else {
      throw ApiException(data['error'] ?? 'Failed to load vehicle');
    }
  }

  Future<Map<String, dynamic>> createVehicle(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/vehicles'),
      headers: _headers,
      body: jsonEncode(data),
    );

    final result = jsonDecode(response.body);
    if (response.statusCode == 201) {
      return result;
    } else {
      throw ApiException(result['error'] ?? 'Failed to create vehicle');
    }
  }

  // Inspections
  Future<List<dynamic>> getInspections({int page = 1, int limit = 20}) async {
    final query = Uri(queryParameters: {
      'page': page.toString(),
      'limit': limit.toString(),
    });

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/inspections$query'),
      headers: _headers,
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data['data'] ?? [];
    } else {
      throw ApiException(data['error'] ?? 'Failed to load inspections');
    }
  }

  Future<Map<String, dynamic>> createInspection({
    required String vehicleId,
    required String type,
    required List<Map<String, dynamic>> checklist,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/inspections'),
      headers: _headers,
      body: jsonEncode({
        'vehicle_id': vehicleId,
        'type': type,
        'checklist': checklist,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 201) {
      return data;
    } else {
      throw ApiException(data['error'] ?? 'Failed to create inspection');
    }
  }

  Future<List<dynamic>> getVehicleInspections(String vehicleId, {int page = 1, int limit = 5}) async {
    final query = Uri(queryParameters: {
      'page': page.toString(),
      'limit': limit.toString(),
    });

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/vehicles/$vehicleId/inspections$query'),
      headers: _headers,
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data['data'] ?? [];
    } else {
      throw ApiException(data['error'] ?? 'Failed to load inspections');
    }
  }

  // Dashboard
  Future<Map<String, dynamic>> getDashboardStats() async {
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/dashboard/stats'),
      headers: _headers,
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data;
    } else {
      throw ApiException(data['error'] ?? 'Failed to load stats');
    }
  }

  // Seed
  Future<Map<String, dynamic>> seedData({int vehicles = 50, int inspections = 100}) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/seed'),
      headers: _headers,
      body: jsonEncode({'vehicles': vehicles, 'inspections': inspections}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return data;
    } else {
      throw ApiException(data['error'] ?? 'Failed to seed data');
    }
  }
}

final api = ApiClient();
