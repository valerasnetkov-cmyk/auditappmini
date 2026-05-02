import 'package:flutter/material.dart';
import '../../api_client.dart';
import '../../config.dart';
import 'photo_capture_screen.dart';

class ChecklistScreen extends StatefulWidget {
  const ChecklistScreen({super.key});

  @override
  State<ChecklistScreen> createState() => _ChecklistScreenState();
}

class _ChecklistScreenState extends State<ChecklistScreen> {
  String? _vehicleId;
  String _inspectionType = 'quick';
  bool _isLoading = true;
  List<Map<String, dynamic>> _checklist = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
      if (args != null) {
        _vehicleId = args['vehicleId'];
        _inspectionType = args['type'] ?? 'quick';
        
        // Initialize checklist items
        final items = _inspectionType == 'quick' 
            ? AppConstants.quickChecklist 
            : AppConstants.fullChecklist;
        
        _checklist = items.map((title) => {
          'title': title,
          'result': null,
          'comment': '',
        }).toList();
      }
      setState(() => _isLoading = false);
    });
  }

  Future<void> _completeInspection() async {
    if (_vehicleId == null) return;
    
    setState(() => _isLoading = true);
    
    try {
      await api.createInspection(
        vehicleId: _vehicleId!,
        type: _inspectionType,
        checklist: _checklist,
      );
      
      if (mounted) {
        Navigator.popUntil(context, (route) => route.isFirst);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Осмотр успешно завершён!'),
            backgroundColor: Colors.green,
          ),
        );
      }
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

  int get _defectsCount => _checklist.where((i) => i['result'] == false).length;
  bool get _canComplete => _checklist.every((i) => i['result'] != null);

  void _onItemResult(int index, bool result) {
    setState(() {
      _checklist[index]['result'] = result;
      
      // If result is false (defect), navigate to photo capture
      if (!result) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => PhotoCaptureScreen(
              defectTitle: _checklist[index]['title'],
            ),
          ),
        );
      }
    });
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
        title: Text(_inspectionType == 'quick' ? 'Быстрый осмотр' : 'Полный осмотр'),
        actions: [
          if (_defectsCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Chip(
                label: Text('$_defectsCount дефектов'),
                backgroundColor: Colors.red.shade100,
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _checklist.length,
              itemBuilder: (context, index) {
                final item = _checklist[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item['title'],
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton(
                                onPressed: () => _onItemResult(index, true),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: item['result'] == true 
                                      ? Colors.green 
                                      : Colors.grey.shade200,
                                  foregroundColor: item['result'] == true 
                                      ? Colors.white 
                                      : Colors.black87,
                                ),
                                child: const Text('✓ ДА'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: ElevatedButton(
                                onPressed: () => _onItemResult(index, false),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: item['result'] == false 
                                      ? Colors.red 
                                      : Colors.grey.shade200,
                                  foregroundColor: item['result'] == false 
                                      ? Colors.white 
                                      : Colors.black87,
                                ),
                                child: const Text('✗ НЕТ'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          
          // Complete Button
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.shade300,
                  blurRadius: 4,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: SafeArea(
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _canComplete ? _completeInspection : null,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: Colors.green,
                  ),
                  child: Text(
                    _canComplete 
                        ? 'Завершить осмотр' 
                        : 'Ответьте на все вопросы',
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
