import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class PhotoScreen extends StatefulWidget {
  const PhotoScreen({super.key});

  @override
  State<PhotoScreen> createState() => _PhotoScreenState();
}

class _PhotoScreenState extends State<PhotoScreen> {
  final SupabaseClient _supabase = Supabase.instance.client;
  String? _inspectionId;
  String? _defectTitle;
  List<String> _photos = [];
  bool _isUploading = false;
  String? _geoLocation;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
      if (args != null) {
        _inspectionId = args['inspectionId'];
        _defectTitle = args['defectTitle'];
      }
      _getLocation();
    });
  }

  Future<void> _getLocation() async {
    // TODO: Implement geolocator
    // For now, just a placeholder
    setState(() {
      _geoLocation = '55.7558, 37.6173'; // Moscow coordinates placeholder
    });
  }

  Future<void> _takePhoto() async {
    // TODO: Implement camera
    // For now, simulate adding a photo
    setState(() {
      _photos.add('https://placeholder.com/photo_${_photos.length + 1}.jpg');
    });
  }

  Future<void> _savePhoto(String url) async {
    if (_inspectionId == null || _defectTitle == null) return;
    
    setState(() => _isUploading = true);
    
    try {
      // First, create defect if not exists
      final defectResponse = await _supabase.from('defects').insert({
        'inspection_id': _inspectionId,
        'title': _defectTitle,
        'comment': 'Зафиксировано при осмотре',
      }).select();
      
      if (defectResponse.isNotEmpty) {
        final defectId = defectResponse.first['id'];
        
        // Then save photo
        await _supabase.from('photos').insert({
          'inspection_id': _inspectionId,
          'defect_id': defectId,
          'url': url,
          'geo': _geoLocation,
          'is_required': false,
        });
      }
      
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ошибка: $e')),
        );
      }
    }
    
    setState(() => _isUploading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Фото дефекта'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_defectTitle != null) ...[
              Text(
                'Дефект: $_defectTitle',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
            ],
            
            // Geo Location
            if (_geoLocation != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      const Icon(Icons.location_on, color: Colors.blue),
                      const SizedBox(width: 8),
                      Text('$_geoLocation'),
                    ],
                  ),
                ),
              ),
            
            const SizedBox(height: 16),
            
            // Take Photo Button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _takePhoto,
                icon: const Icon(Icons.camera_alt),
                label: const Text('Сделать фото'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Photos Grid
            if (_photos.isNotEmpty) ...[
              const Text(
                'Сделано фото:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                itemCount: _photos.length,
                itemBuilder: (context, index) {
                  return Stack(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          color: Colors.grey.shade300,
                        ),
                        child: const Center(
                          child: Icon(Icons.image, size: 40),
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: GestureDetector(
                          onTap: () {
                            setState(() {
                              _photos.removeAt(index);
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Colors.red,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.close,
                              color: Colors.white,
                              size: 16,
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ],
            
            const Spacer(),
            
            // Save Button
            if (_photos.isNotEmpty)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isUploading 
                      ? null 
                      : () => _savePhoto(_photos.first),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _isUploading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Сохранить'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}