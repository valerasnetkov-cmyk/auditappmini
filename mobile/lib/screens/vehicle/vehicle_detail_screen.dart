import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class VehicleDetailScreen extends StatefulWidget {
  const VehicleDetailScreen({super.key});

  @override
  State<VehicleDetailScreen> createState() => _VehicleDetailScreenState();
}

class _VehicleDetailScreenState extends State<VehicleDetailScreen> {
  final SupabaseClient _supabase = Supabase.instance.client;
  String? _vehicleId;
  Map<String, dynamic>? _vehicle;
  List<Map<String, dynamic>> _inspections = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
      if (args != null && args['vehicleId'] != null) {
        _vehicleId = args['vehicleId'];
        _loadVehicle();
      }
    });
  }

  Future<void> _loadVehicle() async {
    if (_vehicleId == null) return;

    try {
      final vehicleResponse = await _supabase
          .from('vehicles')
          .select('*')
          .eq('id', _vehicleId)
          .single();

      final inspectionsResponse = await _supabase
          .from('inspections')
          .select('*, users(name), defects(*, photos(*)), checklist_items(*)')
          .eq('vehicle_id', _vehicleId)
          .order('created_at', ascending: false);

      if (mounted) {
        setState(() {
          _vehicle = vehicleResponse;
          _inspections = List<Map<String, dynamic>>.from(inspectionsResponse);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ошибка: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_vehicle?['number'] ?? 'Техника'),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: () {
              // TODO: Navigate to edit
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadVehicle,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Vehicle Info Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _vehicle?['number'] ?? '',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Chip(
                          label: Text(
                            _vehicle?['status'] == 'active' 
                                ? 'В работе' 
                                : 'Ремонт',
                          ),
                          backgroundColor: _vehicle?['status'] == 'active'
                              ? Colors.green.shade100
                              : Colors.orange.shade100,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _vehicle?['name'] ?? '',
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Inspections
            const Text(
              'История осмотров',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),

            if (_inspections.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(
                    child: Text('Осмотров пока нет'),
                  ),
                ),
              )
            else
              ...(_inspections.map((inspection) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ExpansionTile(
                  title: Text(
                    '${inspection['type'] == 'quick' ? 'Быстрый' : 'Полный'} осмотр',
                  ),
                  subtitle: Text(
                    _formatDate(inspection['created_at']),
                  ),
                  trailing: inspection['completed'] == true
                      ? const Icon(Icons.check_circle, color: Colors.green)
                      : const Icon(Icons.pending, color: Colors.orange),
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Inspector
                          if (inspection['users'] != null)
                            Text(
                              'Инспектор: ${inspection['users']['name']}',
                              style: TextStyle(color: Colors.grey.shade600),
                            ),

                          const SizedBox(height: 12),

                          // Checklist
                          if (inspection['checklist_items'] != null &&
                              (inspection['checklist_items'] as List).isNotEmpty) ...[
                            const Text(
                              'Результаты:',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 8),
                            ...((inspection['checklist_items'] as List).map(
                              (item) => Padding(
                                padding: const EdgeInsets.only(left: 16, bottom: 4),
                                child: Row(
                                  children: [
                                    Icon(
                                      item['result'] == true
                                          ? Icons.check_circle
                                          : Icons.cancel,
                                      size: 16,
                                      color: item['result'] == true
                                          ? Colors.green
                                          : Colors.red,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(item['title'] ?? ''),
                                  ],
                                ),
                              ),
                            )),
                          ],

                          // Defects
                          if (inspection['defects'] != null &&
                              (inspection['defects'] as List).isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Text(
                              'Дефекты: ${(inspection['defects'] as List).length}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.red,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ))),
          ],
        ),
      ),
    );
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '';
    final date = DateTime.parse(dateStr);
    return '${date.day}.${date.month}.${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }
}
