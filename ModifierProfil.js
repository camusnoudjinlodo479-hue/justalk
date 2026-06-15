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

// Fonction utilitaire pour éviter que les requêtes Supabase ne restent bloquées indéfiniment
const withTimeout = (promise, ms = 8000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("La requête réseau a expiré (Timeout de " + (ms/1000) + "s).")), ms)
    )
  ]);
};

export default function ModifierProfil({ navigation }) {
  // Stockage de l'ID utilisateur connecté
  const [userId, setUserId] = useState(null);

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
        console.log("[DEBUG] [loadUserProfile] Récupération de la session utilisateur...");
        
        // Timeout sur la récupération de session
        const authData = await withTimeout(supabase.auth.getUser(), 8000);
        const user = authData?.data?.user;
        
        if (!user) {
          console.warn("[DEBUG] [loadUserProfile] Aucun utilisateur trouvé dans la session.");
          Alert.alert("Erreur", "Aucun utilisateur connecté.");
          if (navigation && navigation.goBack) navigation.goBack();
          return;
        }

        console.log("[DEBUG] [loadUserProfile] Session active. UID récupéré :", user.id);
        setUserId(user.id);

        console.log("[DEBUG] [loadUserProfile] Récupération du profil depuis la table public.users...");
        
        // Timeout sur la requête de base de données
        const { data: profile, error: profileError } = await withTimeout(
          supabase
            .from('users')
            .select('first_name, last_name, pseudo, bio, birthdate')
            .eq('id', user.id)
            .maybeSingle(),
          8000
        );

        if (profileError) {
          console.error("[DEBUG] [loadUserProfile] Erreur Supabase lors de la lecture :", profileError);
          throw profileError;
        }

        if (profile) {
          console.log("[DEBUG] [loadUserProfile] Profil trouvé :", profile);
          setFirstName(profile.first_name || '');
          setLastName(profile.last_name || '');
          setPseudo(profile.pseudo || '');
          setBio(profile.bio || '');
          setBirthdate(profile.birthdate || '');
        } else {
          console.log("[DEBUG] [loadUserProfile] Aucun profil créé pour cet utilisateur dans la table 'users'.");
        }
      } catch (error) {
        console.error("[DEBUG] [loadUserProfile] Exception attrapée :", error.message);
        Alert.alert("Erreur de chargement", error.message || "Impossible de charger les données du profil.");
      } finally {
        setIsLoading(false);
      }
    }

    loadUserProfile();
  }, [navigation]);

  // Fonction de sauvegarde
  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    console.log("[DEBUG] [handleSave] Début de la fonction handleSave()...");

    try {
      // 1. Utilisation de l'ID utilisateur stocké en state pour éviter un appel auth redondant
      if (!userId) {
        console.error("[DEBUG] [handleSave] Pas d'ID utilisateur en mémoire.");
        throw new Error("ID utilisateur introuvable. Veuillez recharger la page.");
      }
      console.log("[DEBUG] [handleSave] ID utilisateur cible :", userId);

      // 2. Validation minimale
      if (!pseudo.trim()) {
        throw new Error("Le pseudo est obligatoire.");
      }

      // 3. Formatage de la date de naissance
      let formattedBirthdate = null;
      if (birthdate.trim()) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(birthdate.trim())) {
          throw new Error("La date de naissance doit être au format AAAA-MM-JJ (ex: 1995-12-31).");
        }
        formattedBirthdate = birthdate.trim();
      }

      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        pseudo: pseudo.trim(),
        bio: bio.trim() || null,
        birthdate: formattedBirthdate,
      };

      console.log("[DEBUG] [handleSave] Envoi des données de mise à jour à Supabase...", payload);

      // 4. Mise à jour avec Timeout pour empêcher le bouton de rester bloqué si la table est verrouillée (DB lock)
      const { error: updateError } = await withTimeout(
        supabase
          .from('users')
          .update(payload)
          .eq('id', userId),
        10000 // 10 secondes max pour répondre
      );

      if (updateError) {
        console.error("[DEBUG] [handleSave] Supabase a retourné une erreur :", updateError);
        
        // Gestion de la contrainte unique pseudo (23505)
        if (updateError.code === '23505') {
          throw new Error("Ce pseudo est déjà pris par un autre utilisateur.");
        }
        throw updateError;
      }

      console.log("[DEBUG] [handleSave] Mise à jour réussie avec succès !");

      Alert.alert(
        "Succès", 
        "Profil mis à jour avec succès !", 
        [{ text: "OK", onPress: () => { if (navigation && navigation.goBack) navigation.goBack(); } }]
      );

    } catch (error) {
      console.error("[DEBUG] [handleSave] Exception attrapée lors de l'enregistrement :", error.message);
      Alert.alert("Erreur de sauvegarde", error.message || "Une erreur est survenue.");
    } finally {
      console.log("[DEBUG] [handleSave] Fin du traitement. Désactivation de isSaving.");
      setIsSaving(false); // Libération systématique du bouton
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

            {/* Pseudo */}
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

            {/* Date de naissance */}
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
              disabled={isSaving}
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
