import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
// ⚠️ Ajustez le chemin d'accès à votre client Supabase configuré
import { supabase } from './lib/supabase'; 

export default function ModifierProfil({ navigation }) {
  // States des champs du formulaire
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [bio, setBio] = useState('');
  const [birthdate, setBirthdate] = useState(''); // Format attendu: AAAA-MM-JJ

  // States de chargement et sauvegarde
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Charger les données actuelles de l'utilisateur au montage du composant
  useEffect(() => {
    async function loadUserProfile() {
      try {
        console.log("Récupération de la session utilisateur...");
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) throw authError;
        if (!user) {
          Alert.alert("Erreur", "Aucun utilisateur connecté.");
          if (navigation && navigation.goBack) navigation.goBack();
          return;
        }

        console.log("Session active. UID:", user.id);

        // Récupérer le profil dans la table public.users
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('first_name, last_name, pseudo, bio, birthdate')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profile) {
          setFirstName(profile.first_name || '');
          setLastName(profile.last_name || '');
          setPseudo(profile.pseudo || '');
          setBio(profile.bio || '');
          setBirthdate(profile.birthdate || '');
        }
      } catch (error) {
        console.error("Erreur lors du chargement du profil:", error.message);
        Alert.alert("Erreur", "Impossible de charger les données du profil.");
      } finally {
        setIsLoading(false);
      }
    }

    loadUserProfile();
  }, [navigation]);

  // Fonction de sauvegarde
  const handleSave = async () => {
    // Empêcher les clics doubles si sauvegarde en cours
    if (isSaving) return;

    setIsSaving(true);
    console.log("Début de handleSave()...");

    try {
      // Vérification que la session et l'utilisateur existent
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error("Erreur d'authentification à la sauvegarde:", authError);
        throw new Error("Session expirée ou invalide. Veuillez vous reconnecter.");
      }

      if (!user || !user.id) {
        console.error("User.id introuvable.");
        throw new Error("Utilisateur non connecté ou ID manquant.");
      }

      console.log("ID utilisateur validé :", user.id);

      // Validation minimale locale
      if (!pseudo.trim()) {
        throw new Error("Le pseudo est obligatoire.");
      }

      // Gestion de la contrainte date (SQL birthdate)
      let formattedBirthdate = null;
      if (birthdate.trim()) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(birthdate.trim())) {
          throw new Error("La date de naissance doit respecter le format AAAA-MM-JJ (ex: 1995-12-31).");
        }
        formattedBirthdate = birthdate.trim();
      }

      console.log("Données prêtes pour l'update Supabase :", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        pseudo: pseudo.trim(),
        bio: bio.trim(),
        birthdate: formattedBirthdate,
      });

      // Mise à jour de la table public.users
      const { error: updateError } = await supabase
        .from('users')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          pseudo: pseudo.trim(),
          bio: bio.trim() || null,
          birthdate: formattedBirthdate,
        })
        .eq('id', user.id);

      if (updateError) {
        console.error("Erreur d'update Supabase reçue :", updateError);
        
        // Gérer l'unicité du pseudo (Code SQL Postgres: 23505)
        if (updateError.code === '23505') {
          throw new Error("Ce pseudo est déjà pris par un autre utilisateur.");
        }
        throw updateError;
      }

      console.log("Mise à jour réussie dans Supabase !");

      // Alerte succès + Navigation retour
      Alert.alert(
        "Succès", 
        "Profil mis à jour avec succès !", 
        [{ text: "OK", onPress: () => { if (navigation && navigation.goBack) navigation.goBack(); } }]
      );

    } catch (error) {
      console.log("Exception capturée dans handleSave :", error.message);
      // Afficher l'erreur à l'utilisateur
      Alert.alert("Erreur de sauvegarde", error.message || "Une erreur est survenue.");
    } finally {
      // Remettre le bouton en mode actif
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Modifier le profil</Text>

          <View style={styles.form}>
            {/* Prénom */}
            <Text style={styles.label}>Prénom</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Votre prénom"
              placeholderTextColor="#94A3B8"
            />

            {/* Nom */}
            <Text style={styles.label}>Nom</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Votre nom"
              placeholderTextColor="#94A3B8"
            />

            {/* Pseudo (Obligatoire & Unique) */}
            <Text style={styles.label}>Pseudo *</Text>
            <TextInput
              style={styles.input}
              value={pseudo}
              onChangeText={setPseudo}
              placeholder="Votre pseudo (unique)"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Date de naissance (SQL date) */}
            <Text style={styles.label}>Date de naissance (AAAA-MM-JJ)</Text>
            <TextInput
              style={styles.input}
              value={birthdate}
              onChangeText={setBirthdate}
              placeholder="Ex: 1998-05-15"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />

            {/* Biographie */}
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Parlez-nous de vous..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
            />

            {/* Bouton d'enregistrement */}
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.disabledButton]}
              onPress={handleSave}
              disabled={isSaving} // Désactiver le bouton pendant le traitement
            >
              {isSaving ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.saveButtonText}>Enregistrement...</Text>
                </View>
              ) : (
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              )}
            </TouchableOpacity>

            {/* Bouton Retour */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => { if (navigation && navigation.goBack) navigation.goBack(); }}
              disabled={isSaving}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 24,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#93C5FD',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
});
