import { useState } from 'react'
import { pb } from '@/lib/auth-utils'

interface ModelResponse {
    success: boolean
    data?: any
    error?: string
}

interface UserInfo {
    age: number
    gender: string
}

export const useHealthModels = () => {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const getUserInfo = async (): Promise<UserInfo | null> => {
        try {
            const user = pb.authStore.model
            if (!user?.id) {
                console.warn('No authenticated user found')
                return null
            }

            const records = await pb.collection('user_info').getList(1, 1, {
                filter: `user_id = "${user.id}"`
            })

            if (records.items.length > 0) {
                const info = records.items[0]
                return {
                    age: info.age || 30, // Default to 30 if not set
                    gender: info.gender || 'female' // Default to female if not set
                }
            }

            // Return defaults if no user info found
            console.warn('No user info found, using defaults')
            return {
                age: 30,
                gender: 'female'
            }
        } catch (err: any) {
            console.error('Error fetching user info:', err)
            // Return defaults on error
            return {
                age: 30,
                gender: 'female'
            }
        }
    }

    const physicalModelSymptoms = [
        "abdominal_pain",
        "abnormal_menstruation",
        "acidity",
        "acute_liver_failure",
        "altered_sensorium",
        "anxiety",
        "back_pain",
        "belly_pain",
        "blackheads",
        "bladder_discomfort",
        "blister",
        "blood_in_sputum",
        "bloody_stool",
        "blurred_and_distorted_vision",
        "breathlessness",
        "brittle_nails",
        "bruising",
        "burning_micturition",
        "chest_pain",
        "chills",
        "cold_hands_and_feets",
        "coma",
        "congestion",
        "constipation",
        "continuous_feel_of_urine",
        "continuous_sneezing",
        "cough",
        "cramps",
        "dark_urine",
        "dehydration",
        "depression",
        "diarrhoea",
        "dischromic _patches",
        "distention_of_abdomen",
        "dizziness",
        "drying_and_tingling_lips",
        "enlarged_thyroid",
        "excessive_hunger",
        "extra_marital_contacts",
        "family_history",
        "fast_heart_rate",
        "fatigue",
        "fluid_overload",
        "foul_smell_of urine",
        "headache",
        "high_fever",
        "hip_joint_pain",
        "history_of_alcohol_consumption",
        "increased_appetite",
        "indigestion",
        "inflammatory_nails",
        "internal_itching",
        "irregular_sugar_level",
        "irritability",
        "irritation_in_anus",
        "joint_pain",
        "knee_pain",
        "lack_of_concentration",
        "lethargy",
        "loss_of_appetite",
        "loss_of_balance",
        "loss_of_smell",
        "malaise",
        "mild_fever",
        "mood_swings",
        "movement_stiffness",
        "mucoid_sputum",
        "muscle_pain",
        "muscle_wasting",
        "muscle_weakness",
        "nausea",
        "neck_pain",
        "nodal_skin_eruptions",
        "obesity",
        "pain_behind_the_eyes",
        "pain_during_bowel_movements",
        "pain_in_anal_region",
        "painful_walking",
        "palpitations",
        "passage_of_gases",
        "patches_in_throat",
        "phlegm",
        "polyuria",
        "prominent_veins_on_calf",
        "puffy_face_and_eyes",
        "pus_filled_pimples",
        "receiving_blood_transfusion",
        "receiving_unsterile_injections",
        "red_sore_around_nose",
        "red_spots_over_body",
        "redness_of_eyes",
        "restlessness",
        "runny_nose",
        "rusty_sputum",
        "scurring",
        "shivering",
        "silver_like_dusting",
        "sinus_pressure",
        "skin_peeling",
        "skin_rash",
        "slurred_speech",
        "small_dents_in_nails",
        "spinning_movements",
        "spotting_ urination",
        "stiff_neck",
        "stomach_bleeding",
        "stomach_pain",
        "sunken_eyes",
        "sweating",
        "swelled_lymph_nodes",
        "swelling_joints",
        "swelling_of_stomach",
        "swollen_blood_vessels",
        "swollen_extremeties",
        "swollen_legs",
        "throat_irritation",
        "toxic_look_(typhos)",
        "ulcers_on_tongue",
        "unsteadiness",
        "visual_disturbances",
        "vomiting",
        "watering_from_eyes",
        "weakness_in_limbs",
        "weakness_of_one_body_side",
        "weight_gain",
        "weight_loss",
        "yellow_crust_ooze",
        "yellow_urine",
        "yellowing_of_eyes",
        "yellowish_skin",
        "itching"
    ]

    const mentalModelSymptoms = [
        "feeling_sad",
        "feeling_hopeless",
        "feeling_empty",
        "feeling_worthless",
        "guilt",
        "loss_of_interest",
        "crying_spells",
        "irritability",
        "mood_swings",
        "feeling_euphoric",
        "feeling_energetic",
        "excessive_worry",
        "panic_attacks",
        "fear_of_crowds",
        "restlessness",
        "feeling_tense",
        "racing_thoughts",
        "difficulty_concentrating",
        "fear_of_losing_control",
        "physical_symptoms_anxiety",
        "insomnia",
        "sleeping_too_much",
        "fatigue",
        "appetite_changes",
        "weight_changes",
        "headaches",
        "muscle_tension",
        "social_withdrawal",
        "avoiding_activities",
        "substance_use",
        "self_harm_thoughts",
        "risky_behavior"
    ]

    const callPhysicalModel = async (symptoms: string[]): Promise<ModelResponse> => {
        try {
            setIsLoading(true)
            setError(null)

            console.log('Calling physical model with symptoms:', symptoms)

            const response = await pb.send('/physical-model/', {
                method: 'POST',
                body: JSON.stringify({ symptoms: symptoms })
            })

            console.log('Physical model response:', response)

            const decodedData = atob(response.result);
            return {
                success: true,
                data: decodedData
            }
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to call physical model'
            console.error('Physical model error:', err)
            setError(errorMessage)

            return {
                success: false,
                error: errorMessage
            }
        } finally {
            setIsLoading(false)
        }
    }

    const callMentalModel = async (symptoms: string[]): Promise<ModelResponse> => {
        try {
            setIsLoading(true)
            setError(null)

            console.log('Calling mental model with symptoms:', symptoms)

            // Get user info from PocketBase
            const userInfo = await getUserInfo()
            const age = userInfo?.age || 30
            const gender = userInfo?.gender || 'female'

            console.log('Using user info:', { age, gender })

            const response = await pb.send('/mental-model/', {
                method: 'POST',
                body: JSON.stringify({
                    symptoms: symptoms,
                    age: age,
                    gender: gender
                })
            })

            console.log('Mental model response:', response)
            const decodedData = atob(response.result);
            return {
                success: true,
                data: decodedData
            }
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to call mental model'
            console.error('Mental model error:', err)
            setError(errorMessage)

            return {
                success: false,
                error: errorMessage
            }
        } finally {
            setIsLoading(false)
        }
    }

    return {
        callPhysicalModel,
        callMentalModel,
        getUserInfo,
        physicalModelSymptoms,
        mentalModelSymptoms,
        isLoading,
        error
    }
}
