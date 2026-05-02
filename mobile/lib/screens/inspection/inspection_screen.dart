import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../config.dart';
import '../qr_scanner_screen.dart';

class InspectionScreen extends StatefulWidget {
  const InspectionScreen({super.key});

  @override
  State<InspectionScreen> createState() => _InspectionScreenState();
}

class _InspectionScreenState extends State<InspectionScreen> {
  final _searchController = TextEditingController();
  List<dynamic> _vehicles = [];
  List<dynamic> _filteredVehicles = [];
  String? _selectedVehicleId;
  String _inspectionType = 'quick';
  bool _isLoading = false;
  String? _scannedQR;

  @override
  void initState() {
    super.initState();
    loadVehicles();
  }

  Future<void> loadVehicles() async {
    try {
      setState(() => _isLoading = true);
      final vehicles = await api.getVehiclesList();
      setState(() {
        _vehicles = vehicles;
        _filteredVehicles = vehicles;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ошибка: $e')),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _filterVehicles(String query) {
    setState(() {
      if (query.isEmpty) {
        _filteredVehicles = _vehicles;
      } else {
        _filteredVehicles = _vehicles.where((v) {
          final number = v['number']?.toString().toLowerCase() ?? '';
          final name = v['name']?.toString().toLowerCase() ?? '';
          final q = query.toLowerCase();
          return number.contains(q) || name.contains(q);
        }).toList();
      }
    });
  }

  Future<void> _scanQR() async {
    final result = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const QRScannerScreen()),
    );

    if (result != null) {
      setState(() {
        _scannedQR = result;
      });
      
      // Find vehicle by QR code (qr_code stores the brand)
      final vehicle = _vehicles.firstWhere(
        (v) => v['qr_code']?.toString().toLowerCase() == result.toLowerCase(),
        orElse: () => null,
      );
      
      if (vehicle != null) {
        setState(() {
          _selectedVehicleId = vehicle['id'];
        });
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Техника с QR "$result" не найдена')),
          );
        }
      }
    }
  }

  void _startInspection() {
    if (_selectedVehicleId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Выберите технику')),
      );
      return;
    }

    Navigator.pushNamed(
      context,
      '/checklist',
      arguments: {
        'vehicleId': _selectedVehicleId,
        'type': _inspectionType,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Начать осмотр'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // QR Scanner Button
                  Card(
                    child: InkWell(
                      onTap: _scanQR,
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).primaryColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(
                                Icons.qr_code_scanner,
                                size: 32,
                                color: Theme.of(context).primaryColor,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Сканировать QR-код',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Text(
                                    _scannedQR ?? 'Нажмите для сканирования',
                                    style: TextStyle(
                                      color: _scannedQR != null 
                                          ? Colors.green 
                                          : Colors.grey,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right),
                          ],
                        ),
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  const Divider(),
                  const SizedBox(height: 16),
                  
                  // Search
                  const Text(
                    'Или выберите из списка',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _searchController,
                    decoration: const InputDecoration(
                      hintText: 'Поиск по госномеру...',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                    ),
                    onChanged: _filterVehicles,
                  ),
                  
                  const SizedBox(height: 8),
                  
                  // Vehicle List
                  Expanded(
                    child: ListView.builder(
                      itemCount: _filteredVehicles.length,
                      itemBuilder: (context, index) {
                        final vehicle = _filteredVehicles[index];
                        final isSelected = _selectedVehicleId == vehicle['id'];
                        
                        return Card(
                          color: isSelected ? Theme.of(context).primaryColor.withOpacity(0.1) : null,
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: vehicle['status'] == 'active'
                                  ? Colors.green
                                  : Colors.orange,
                              child: const Icon(Icons.directions_car, color: Colors.white),
                            ),
                            title: Text(vehicle['number'] ?? ''),
                            subtitle: Text(vehicle['name'] ?? ''),
                            trailing: isSelected
                                ? const Icon(Icons.check_circle, color: Colors.green)
                                : null,
                            onTap: () {
                              setState(() {
                                _selectedVehicleId = vehicle['id'];
                                _scannedQR = null;
                              });
                            },
                          ),
                        );
                      },
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Inspection Type
                  const Text(
                    'Тип осмотра',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: RadioListTile<String>(
                          title: const Text('Быстрый'),
                          subtitle: Text('${AppConstants.quickChecklist.length} пунктов'),
                          value: 'quick',
                          groupValue: _inspectionType,
                          onChanged: (value) {
                            setState(() => _inspectionType = value!);
                          },
                        ),
                      ),
                      Expanded(
                        child: RadioListTile<String>(
                          title: const Text('Полный'),
                          subtitle: Text('${AppConstants.fullChecklist.length} пунктов'),
                          value: 'full',
                          groupValue: _inspectionType,
                          onChanged: (value) {
                            setState(() => _inspectionType = value!);
                          },
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Start Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _selectedVehicleId != null ? _startInspection : null,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: const Text('Начать осмотр'),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
